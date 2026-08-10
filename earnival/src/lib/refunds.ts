import { Prisma, type RefundReason } from "@prisma/client";

import { db } from "./db";
import { generatePaymentReference } from "./ids";
import { allocate, formatNaira, splitSale, splitTicketSale } from "./money";
import { createRefund } from "./paystack";
import { sendEmail } from "./mail";
import { alertRefundFailed } from "./observability";

/**
 * Refunds — PRD Decision #9, resolved 2026-08-08.
 *
 * POLICY: the buyer is made whole. Earnival reverses its service charge and the
 * organiser's connection share off the parties who were credited. The payment
 * processor does not return its fee, so Earnival absorbs that — recorded
 * explicitly as PROCESSING_FEE_ABSORBED rather than quietly written off.
 *
 * MECHANISM: original ledger entries are never edited. A refund appends
 * contra-entries, so every balance stays the plain sum of its rows and the
 * audit trail shows both the sale and its reversal.
 */

export const REFUND_POLICY = {
  /** Earnival gives back its service charge. */
  returnPlatformServiceFee: true,
  /** The organiser gives back their connection share. */
  returnOrganiserShare: true,
  /** The buyer gets the processing fee back even though the PSP keeps it. */
  makeBuyerWhole: true,
  /** Refusing refunds after entry/collection — the goods were delivered. */
  allowAfterCheckIn: false,
  allowAfterPickup: false,
} as const;

export class RefundError extends Error {}

type Tx = Prisma.TransactionClient;

// ------------------------------------------------------------------
// Orders
// ------------------------------------------------------------------

export interface RefundOrderInput {
  orderId: string;
  /** Goods value to reverse. Omit for a full refund. */
  goodsKobo?: number;
  reason: RefundReason;
  note?: string;
  actorUserId: string;
  /** Set when an admin or the platform acts rather than the shop owner. */
  bypassOwnerCheck?: boolean;
}

export async function refundOrder(input: RefundOrderInput): Promise<{ refundId: string }> {
  const refundId = await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      include: { shop: true, event: true, items: true, payment: true, refunds: true },
    });
    if (!order) throw new RefundError("Order not found");

    if (!input.bypassOwnerCheck && order.shop.ownerId !== input.actorUserId) {
      throw new RefundError("You don't have access to that order");
    }
    if (!order.paidAt) {
      throw new RefundError("That order was never paid, so there is nothing to refund");
    }
    if (order.status === "COMPLETED" && !REFUND_POLICY.allowAfterPickup) {
      throw new RefundError(
        "That order was already collected. Collected orders can't be refunded in-app.",
      );
    }

    const alreadyRefunded = order.refunds
      .filter((r) => r.status !== "FAILED")
      .reduce((a, r) => a + r.goodsKobo, 0);
    const refundableKobo = order.subtotalKobo - alreadyRefunded;

    if (refundableKobo <= 0) throw new RefundError("That order is already fully refunded");

    const goodsKobo = input.goodsKobo ?? refundableKobo;
    if (!Number.isInteger(goodsKobo) || goodsKobo <= 0) {
      throw new RefundError("Refund amount must be a positive whole number of kobo");
    }
    if (goodsKobo > refundableKobo) {
      throw new RefundError(
        `Only ${formatNaira(refundableKobo)} of that order is still refundable`,
      );
    }

    const isFull = goodsKobo === refundableKobo && alreadyRefunded === 0;

    // The buyer paid processing proportionally; give back the matching slice.
    const processingKobo = REFUND_POLICY.makeBuyerWhole
      ? isFull
        ? order.processingFeeKobo
        : Math.round((order.processingFeeKobo * goodsKobo) / order.subtotalKobo)
      : 0;

    const refund = await tx.refund.create({
      data: {
        reference: `rf_${generatePaymentReference().slice(4)}`,
        paymentId: order.paymentId!,
        orderId: order.id,
        amountKobo: goodsKobo + processingKobo,
        goodsKobo,
        processingFeeKobo: processingKobo,
        reason: input.reason,
        note: input.note ?? null,
        requestedById: input.actorUserId,
        status: "PENDING",
      },
    });

    await writeOrderContraEntries(tx, {
      refundId: refund.id,
      order,
      goodsKobo,
      processingKobo,
      isFull,
    });

    // A full refund puts the stock back; a partial one can't know which items.
    if (isFull) {
      for (const item of order.items) {
        await tx.$executeRaw`
          UPDATE "Product" SET stock = stock + ${item.quantity} WHERE id = ${item.productId}
        `;
      }
    }

    const totalRefunded = alreadyRefunded + goodsKobo;
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: totalRefunded >= order.subtotalKobo ? "REFUNDED" : "PARTIALLY_REFUNDED",
        cancelledAt: totalRefunded >= order.subtotalKobo ? new Date() : undefined,
      },
    });

    return refund.id;
  });

  await executeRefund(refundId);
  return { refundId };
}

async function writeOrderContraEntries(
  tx: Tx,
  params: {
    refundId: string;
    order: {
      id: string;
      eventId: string | null;
      shopId: string;
      reference: string;
      subtotalKobo: number;
      serviceFeeBps: number;
      revenueShareBps: number;
      paymentId: string | null;
      shop: { ownerId: string };
      event: { organiserId: string } | null;
    };
    goodsKobo: number;
    processingKobo: number;
    isFull: boolean;
  },
): Promise<void> {
  const { refundId, order, goodsKobo, processingKobo, isFull } = params;

  let vendorKobo: number;
  let serviceKobo: number;
  let organiserKobo: number;

  if (isFull) {
    // Reverse exactly what was credited, so a full refund reconciles to zero
    // with no rounding residue.
    const original = await tx.ledgerEntry.findMany({
      where: { orderId: order.id, refundId: null },
    });
    vendorKobo = sumFor(original, "VENDOR_NET");
    serviceKobo = sumFor(original, "PLATFORM_SERVICE_FEE");
    organiserKobo = sumFor(original, "ORGANISER_SHARE");
  } else {
    const split = splitSale({
      grossKobo: goodsKobo,
      serviceFeeBps: order.serviceFeeBps,
      revenueShareBps: order.revenueShareBps,
    });
    vendorKobo = split.vendorNetKobo;
    serviceKobo = split.serviceFeeKobo;
    organiserKobo = split.organiserShareKobo;
  }

  const lines: Prisma.LedgerEntryCreateManyInput[] = [
    {
      account: "VENDOR_NET",
      amountKobo: -vendorKobo,
      partyId: order.shop.ownerId,
      refundId,
      orderId: order.id,
      eventId: order.eventId,
      shopId: order.shopId,
      paymentId: order.paymentId,
      description: `Refund reversal — order ${order.reference}`,
    },
  ];

  if (REFUND_POLICY.returnPlatformServiceFee && serviceKobo > 0) {
    lines.push({
      account: "PLATFORM_SERVICE_FEE",
      amountKobo: -serviceKobo,
      partyId: null,
      refundId,
      orderId: order.id,
      eventId: order.eventId,
      shopId: order.shopId,
      paymentId: order.paymentId,
      description: `Service charge returned — order ${order.reference}`,
    });
  }

  if (REFUND_POLICY.returnOrganiserShare && organiserKobo > 0 && order.event) {
    lines.push({
      account: "ORGANISER_SHARE",
      amountKobo: -organiserKobo,
      partyId: order.event.organiserId,
      refundId,
      orderId: order.id,
      eventId: order.eventId,
      shopId: order.shopId,
      paymentId: order.paymentId,
      description: `Connection share returned — order ${order.reference}`,
    });
  }

  if (processingKobo > 0) {
    // The processor keeps its fee; Earnival covers it so the buyer is whole.
    // This is the platform's actual loss on the refund.
    lines.push({
      account: "PROCESSING_FEE_ABSORBED",
      amountKobo: -processingKobo,
      partyId: null,
      refundId,
      orderId: order.id,
      eventId: order.eventId,
      shopId: order.shopId,
      paymentId: order.paymentId,
      description: `Processing fee absorbed on refund — order ${order.reference}`,
    });
  }

  // Note: cash returned to the buyer is deliberately NOT a ledger entry. The
  // debits above already remove the money from everyone who was credited;
  // adding a REFUND credit would inflate the platform's balance by the same
  // amount it just gave back. The Refund row is the record of the outflow.
  await tx.ledgerEntry.createMany({ data: lines });
}

function sumFor(
  entries: { account: string; amountKobo: number }[],
  account: string,
): number {
  return entries
    .filter((e) => e.account === account)
    .reduce((a, e) => a + e.amountKobo, 0);
}

// ------------------------------------------------------------------
// Tickets
// ------------------------------------------------------------------

export interface RefundTicketsInput {
  ticketIds: string[];
  reason: RefundReason;
  note?: string;
  actorUserId: string;
  bypassOwnerCheck?: boolean;
}

export async function refundTickets(
  input: RefundTicketsInput,
): Promise<{ refundId: string | null }> {
  const refundId = await db.$transaction(async (tx) => {
    const tickets = await tx.ticket.findMany({
      where: { id: { in: input.ticketIds } },
      include: { event: true },
    });
    if (tickets.length === 0) throw new RefundError("No tickets found");

    const event = tickets[0].event;
    if (!input.bypassOwnerCheck && event.organiserId !== input.actorUserId) {
      throw new RefundError("You don't run this event");
    }
    if (tickets.some((t) => t.eventId !== event.id)) {
      throw new RefundError("Refund tickets one event at a time");
    }

    const refundable = tickets.filter((t) => {
      if (t.status === "REFUNDED" || t.status === "CANCELLED") return false;
      if (t.status === "CHECKED_IN" && !REFUND_POLICY.allowAfterCheckIn) return false;
      return true;
    });

    if (refundable.length === 0) {
      throw new RefundError(
        "None of those tickets can be refunded — they're already refunded, or the holder has been checked in",
      );
    }

    const paymentId = refundable[0].paymentId;
    if (!paymentId) throw new RefundError("Those tickets have no payment attached");
    if (refundable.some((t) => t.paymentId !== paymentId)) {
      throw new RefundError("Refund tickets from one payment at a time");
    }

    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const goodsKobo = refundable.reduce((a, t) => a + t.pricePaidKobo, 0);
    if (goodsKobo === 0) {
      // Free tickets: void them, no money movement.
      await tx.ticket.updateMany({
        where: { id: { in: refundable.map((t) => t.id) } },
        data: { status: "REFUNDED" },
      });
      await restoreTicketCounts(tx, refundable);
      return null;
    }

    const isFullPayment = goodsKobo === payment.subtotalKobo;
    const processingKobo = REFUND_POLICY.makeBuyerWhole
      ? isFullPayment
        ? payment.processingFeeKobo
        : Math.round((payment.processingFeeKobo * goodsKobo) / payment.subtotalKobo)
      : 0;

    const refund = await tx.refund.create({
      data: {
        reference: `rf_${generatePaymentReference().slice(4)}`,
        paymentId,
        amountKobo: goodsKobo + processingKobo,
        goodsKobo,
        processingFeeKobo: processingKobo,
        reason: input.reason,
        note: input.note ?? null,
        requestedById: input.actorUserId,
        status: "PENDING",
      },
    });

    const split = splitTicketSale(goodsKobo, event.serviceFeeBps);
    const lines: Prisma.LedgerEntryCreateManyInput[] = [
      {
        account: "ORGANISER_TICKET_NET",
        amountKobo: -split.organiserNetKobo,
        partyId: event.organiserId,
        refundId: refund.id,
        eventId: event.id,
        paymentId,
        description: `Refund reversal — ${refundable.length} ticket(s), ${event.name}`,
      },
    ];

    if (REFUND_POLICY.returnPlatformServiceFee && split.serviceFeeKobo > 0) {
      lines.push({
        account: "PLATFORM_SERVICE_FEE",
        amountKobo: -split.serviceFeeKobo,
        partyId: null,
        refundId: refund.id,
        eventId: event.id,
        paymentId,
        description: `Service charge returned — ${event.name}`,
      });
    }

    if (processingKobo > 0) {
      lines.push({
        account: "PROCESSING_FEE_ABSORBED",
        amountKobo: -processingKobo,
        partyId: null,
        refundId: refund.id,
        eventId: event.id,
        paymentId,
        description: `Processing fee absorbed on refund — ${event.name}`,
      });
    }

    // See the note in writeOrderContraEntries: the cash outflow is recorded on
    // the Refund row, not as a ledger credit.
    await tx.ledgerEntry.createMany({ data: lines });

    await tx.ticket.updateMany({
      where: { id: { in: refundable.map((t) => t.id) } },
      data: { status: "REFUNDED" },
    });
    await restoreTicketCounts(tx, refundable);

    return refund.id;
  });

  if (refundId) await executeRefund(refundId);
  return { refundId };
}

/** Returns refunded seats to the pool so they can be resold. */
async function restoreTicketCounts(
  tx: Tx,
  tickets: { ticketTypeId: string }[],
): Promise<void> {
  const counts = new Map<string, number>();
  for (const ticket of tickets) {
    counts.set(ticket.ticketTypeId, (counts.get(ticket.ticketTypeId) ?? 0) + 1);
  }
  for (const [ticketTypeId, qty] of counts) {
    await tx.$executeRaw`
      UPDATE "TicketType" SET sold = GREATEST(0, sold - ${qty}) WHERE id = ${ticketTypeId}
    `;
  }
}

// ------------------------------------------------------------------
// Event cancellation
// ------------------------------------------------------------------

/**
 * Cancels an event and refunds every ticket and paid order against it. Each
 * payment is refunded separately so one failure cannot strand the rest.
 */
export async function cancelEventAndRefundAll(params: {
  eventId: string;
  actorUserId: string;
  note?: string;
  bypassOwnerCheck?: boolean;
}): Promise<{ ticketsRefunded: number; ordersRefunded: number; failures: string[] }> {
  const event = await db.event.findUnique({ where: { id: params.eventId } });
  if (!event) throw new RefundError("Event not found");
  if (!params.bypassOwnerCheck && event.organiserId !== params.actorUserId) {
    throw new RefundError("You don't run this event");
  }

  await db.event.update({
    where: { id: params.eventId },
    data: { status: "CANCELLED" },
  });

  const failures: string[] = [];

  const tickets = await db.ticket.findMany({
    where: { eventId: params.eventId, status: { in: ["VALID", "CHECKED_IN"] } },
    select: { id: true, paymentId: true },
  });

  const byPayment = new Map<string, string[]>();
  for (const ticket of tickets) {
    if (!ticket.paymentId) continue;
    byPayment.set(ticket.paymentId, [
      ...(byPayment.get(ticket.paymentId) ?? []),
      ticket.id,
    ]);
  }

  let ticketsRefunded = 0;
  for (const [, ticketIds] of byPayment) {
    try {
      await refundTickets({
        ticketIds,
        reason: "EVENT_CANCELLED",
        note: params.note,
        actorUserId: params.actorUserId,
        bypassOwnerCheck: true,
      });
      ticketsRefunded += ticketIds.length;
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }

  const orders = await db.order.findMany({
    where: {
      eventId: params.eventId,
      paidAt: { not: null },
      status: { notIn: ["REFUNDED", "CANCELLED"] },
    },
    select: { id: true },
  });

  let ordersRefunded = 0;
  for (const order of orders) {
    try {
      await refundOrder({
        orderId: order.id,
        reason: "EVENT_CANCELLED",
        note: params.note,
        actorUserId: params.actorUserId,
        bypassOwnerCheck: true,
      });
      ordersRefunded += 1;
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }

  return { ticketsRefunded, ordersRefunded, failures };
}

// ------------------------------------------------------------------
// Provider execution
// ------------------------------------------------------------------

/**
 * Sends the refund to the processor. The ledger already reflects the reversal;
 * this moves the actual cash. A failure here marks the refund FAILED and leaves
 * a trail for an operator, rather than silently diverging from the ledger.
 */
async function executeRefund(refundId: string): Promise<void> {
  const refund = await db.refund.findUnique({
    where: { id: refundId },
    include: { payment: true, order: { include: { shop: true } } },
  });
  if (!refund || refund.status !== "PENDING") return;

  await db.refund.update({ where: { id: refundId }, data: { status: "PROCESSING" } });

  try {
    const result = await createRefund({
      transactionReference: refund.payment.reference,
      amountKobo: refund.amountKobo,
      reason: refund.note ?? refund.reason,
    });

    await db.refund.update({
      where: { id: refundId },
      data: {
        status: "COMPLETED",
        providerReference: result.providerReference,
        completedAt: new Date(),
      },
    });

    await sendEmail({
      to: refund.payment.buyerEmail,
      subject: `Refund on the way — ${formatNaira(refund.amountKobo)}`,
      text: `Your refund of ${formatNaira(
        refund.amountKobo,
      )} has been sent back to your original payment method. It usually lands within 5–10 business days.`,
      html: `<p>Your refund of <b>${formatNaira(
        refund.amountKobo,
      )}</b> is on its way back to your original payment method.</p><p>It usually lands within 5–10 business days.</p>`,
    }).catch(() => {});
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await db.refund.update({
      where: { id: refundId },
      data: { status: "FAILED", failureReason: reason },
    });
    // The ledger already shows this reversed but the cash did not move — that
    // divergence needs a person, urgently.
    await alertRefundFailed({
      reference: refund.reference,
      amountKobo: refund.amountKobo,
      reason,
    });
  }
}

/** Called from the Paystack webhook when a refund settles or fails. */
export async function markRefundOutcome(
  providerReference: string,
  outcome: "COMPLETED" | "FAILED",
  failureReason?: string,
): Promise<void> {
  await db.refund.updateMany({
    where: { providerReference },
    data: {
      status: outcome,
      failureReason: failureReason ?? null,
      completedAt: outcome === "COMPLETED" ? new Date() : null,
    },
  });
}
