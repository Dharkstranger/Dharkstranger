import { randomUUID } from "node:crypto";
import { Prisma, type PaymentStatus } from "@prisma/client";

import { db } from "./db";
import {
  generatePaymentReference,
  generatePickupCode,
  generateTicketCode,
} from "./ids";
import { issueTicketToken, ticketUrl } from "./qr";
import {
  allocate,
  buyerTotal,
  ledgerLinesForOrder,
  ledgerLinesForTickets,
  splitSale,
  splitTicketSale,
  formatNaira,
} from "./money";
import {
  orderReceiptEmail,
  pickupReadyEmail,
  sendEmail,
  ticketEmail,
} from "./mail";
import { checkRevenueCap } from "./verification";

export class SoldOutError extends Error {}
export class CheckoutError extends Error {}
/** Raised when a sale would push an event past its verification-level cap. */
export class RevenueCapError extends Error {}

/** PRD VRF-01: an unapproved paid event may not sell. */
function assertApprovedForSale(approvalStatus: string): void {
  if (approvalStatus === "PENDING_REVIEW") {
    throw new CheckoutError("This event is awaiting review and isn't on sale yet");
  }
  if (approvalStatus === "REJECTED") {
    throw new CheckoutError("This event isn't available");
  }
}

/**
 * PRD VRF-05: caps are enforced per event, whatever the sale channel. The
 * check runs inside the checkout transaction and counts in-flight
 * reservations, so concurrent buyers cannot straddle the limit.
 */
async function assertWithinCap(
  tx: Tx,
  eventId: string,
  incomingKobo: number,
): Promise<void> {
  const cap = await checkRevenueCap(eventId, incomingKobo, tx);
  if (!cap.wouldExceed) return;

  throw new RevenueCapError(
    cap.remainingKobo && cap.remainingKobo > 0
      ? `This event has ${formatNaira(cap.remainingKobo)} of its revenue limit left. ` +
        `Reduce the amount, or ask the organiser to verify their account to raise the limit.`
      : `This event has reached its revenue limit of ${formatNaira(cap.capKobo ?? 0)}. ` +
        `The organiser needs to verify their account to keep selling.`,
  );
}

/** How long an unpaid checkout holds its inventory. */
const RESERVATION_TTL_MINUTES = 20;

type Tx = Prisma.TransactionClient;

// ------------------------------------------------------------------
// Atomic inventory
// ------------------------------------------------------------------

/**
 * Reserves ticket inventory with a single conditional UPDATE.
 *
 * The `sold + reserved + n <= quantity` predicate lives inside the statement,
 * so Postgres row-locks the type and two concurrent buyers competing for the
 * last seat cannot both succeed. Read-then-write in application code — which
 * is what the prototype did — loses that race.
 */
async function reserveTicketInventory(
  tx: Tx,
  ticketTypeId: string,
  qty: number,
): Promise<void> {
  const affected = await tx.$executeRaw`
    UPDATE "TicketType"
    SET reserved = reserved + ${qty}
    WHERE id = ${ticketTypeId}
      AND active = true
      AND sold + reserved + ${qty} <= quantity
  `;
  if (affected === 0) {
    throw new SoldOutError("Not enough tickets left for that type");
  }
}

async function reserveProductStock(
  tx: Tx,
  productId: string,
  qty: number,
): Promise<void> {
  const affected = await tx.$executeRaw`
    UPDATE "Product"
    SET reserved = reserved + ${qty}
    WHERE id = ${productId}
      AND active = true
      AND reserved + ${qty} <= stock
  `;
  if (affected === 0) {
    throw new SoldOutError("Not enough stock left for that product");
  }
}

/** Converts a held reservation into a confirmed sale. */
async function commitTicketInventory(tx: Tx, ticketTypeId: string, qty: number) {
  await tx.$executeRaw`
    UPDATE "TicketType"
    SET reserved = GREATEST(0, reserved - ${qty}), sold = sold + ${qty}
    WHERE id = ${ticketTypeId}
  `;
}

async function commitProductStock(tx: Tx, productId: string, qty: number) {
  await tx.$executeRaw`
    UPDATE "Product"
    SET reserved = GREATEST(0, reserved - ${qty}), stock = GREATEST(0, stock - ${qty})
    WHERE id = ${productId}
  `;
}

async function releaseTicketInventory(tx: Tx, ticketTypeId: string, qty: number) {
  await tx.$executeRaw`
    UPDATE "TicketType" SET reserved = GREATEST(0, reserved - ${qty}) WHERE id = ${ticketTypeId}
  `;
}

async function releaseProductStock(tx: Tx, productId: string, qty: number) {
  await tx.$executeRaw`
    UPDATE "Product" SET reserved = GREATEST(0, reserved - ${qty}) WHERE id = ${productId}
  `;
}

async function uniqueTicketCode(tx: Tx, slug: string): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateTicketCode(slug);
    const clash = await tx.ticket.findUnique({ where: { code }, select: { id: true } });
    if (!clash) return code;
  }
  throw new CheckoutError("Could not allocate a unique ticket code");
}

// ------------------------------------------------------------------
// Ticket checkout
// ------------------------------------------------------------------

export interface TicketCheckoutInput {
  eventSlug: string;
  lines: { ticketTypeId: string; quantity: number }[];
  buyer: { name: string; email: string; phone?: string | null };
  userId?: string | null;
}

export interface CheckoutResult {
  paymentId: string;
  reference: string;
  amountKobo: number;
  free: boolean;
}

export async function createTicketCheckout(
  input: TicketCheckoutInput,
): Promise<CheckoutResult> {
  const { eventSlug, lines, buyer, userId } = input;

  if (lines.length === 0) throw new CheckoutError("Select at least one ticket");
  if (lines.some((l) => !Number.isInteger(l.quantity) || l.quantity < 1)) {
    throw new CheckoutError("Ticket quantities must be whole numbers");
  }
  const requested = lines.reduce((a, l) => a + l.quantity, 0);
  if (requested > 20) throw new CheckoutError("Maximum 20 tickets per checkout");

  return db.$transaction(async (tx) => {
    const event = await tx.event.findUnique({
      where: { slug: eventSlug },
      include: { ticketTypes: true },
    });
    if (!event) throw new CheckoutError("Event not found");
    if (event.status === "CANCELLED") {
      throw new CheckoutError("This event has been cancelled");
    }
    if (event.status !== "LIVE") throw new CheckoutError("This event isn't on sale");
    assertApprovedForSale(event.approvalStatus);

    // Prices always come from the database. Anything the client sent about
    // price is ignored outright.
    let subtotalKobo = 0;
    const resolved = lines.map((line) => {
      const type = event.ticketTypes.find((t) => t.id === line.ticketTypeId);
      if (!type) throw new CheckoutError("Unknown ticket type");
      if (!type.active) throw new CheckoutError(`${type.name} is no longer on sale`);
      subtotalKobo += type.priceKobo * line.quantity;
      return { type, quantity: line.quantity };
    });

    await assertWithinCap(tx, event.id, subtotalKobo);

    for (const line of resolved) {
      await reserveTicketInventory(tx, line.type.id, line.quantity);
    }

    const totals = buyerTotal(subtotalKobo, event.processingFeeBps);
    const free = totals.totalKobo === 0;

    const payment = await tx.payment.create({
      data: {
        reference: generatePaymentReference(),
        purpose: "TICKETS",
        amountKobo: totals.totalKobo,
        subtotalKobo: totals.subtotalKobo,
        processingFeeKobo: totals.processingFeeKobo,
        status: "PENDING",
        buyerName: buyer.name,
        buyerEmail: buyer.email.toLowerCase(),
        buyerPhone: buyer.phone ?? null,
        userId: userId ?? null,
        eventId: event.id,
        expiresAt: new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000),
      },
    });

    for (const line of resolved) {
      for (let i = 0; i < line.quantity; i += 1) {
        const ticketId = randomUUID();
        await tx.ticket.create({
          data: {
            id: ticketId,
            code: await uniqueTicketCode(tx, event.slug),
            qrToken: issueTicketToken(ticketId),
            eventId: event.id,
            ticketTypeId: line.type.id,
            paymentId: payment.id,
            attendeeName: buyer.name,
            attendeeEmail: buyer.email.toLowerCase(),
            attendeePhone: buyer.phone ?? null,
            userId: userId ?? null,
            pricePaidKobo: line.type.priceKobo,
            status: "PENDING_PAYMENT",
          },
        });
      }
    }

    return {
      paymentId: payment.id,
      reference: payment.reference,
      amountKobo: totals.totalKobo,
      free,
    };
  });
}

// ------------------------------------------------------------------
// Product checkout
// ------------------------------------------------------------------

export interface ProductCheckoutInput {
  eventSlug: string | null;
  items: { productId: string; quantity: number }[];
  buyer: { name: string; email: string; phone?: string | null };
  userId?: string | null;
  payNow: boolean;
}

export interface ProductCheckoutResult extends CheckoutResult {
  groupRef: string;
  orderReferences: string[];
}

export async function createProductCheckout(
  input: ProductCheckoutInput,
): Promise<ProductCheckoutResult> {
  const { eventSlug, items, buyer, userId, payNow } = input;

  if (items.length === 0) throw new CheckoutError("Your basket is empty");
  if (items.some((i) => !Number.isInteger(i.quantity) || i.quantity < 1)) {
    throw new CheckoutError("Quantities must be whole numbers");
  }

  return db.$transaction(async (tx) => {
    const event = eventSlug
      ? await tx.event.findUnique({ where: { slug: eventSlug } })
      : null;
    if (eventSlug && !event) throw new CheckoutError("Event not found");
    if (event) {
      if (event.status === "CANCELLED") {
        throw new CheckoutError("This event has been cancelled");
      }
      assertApprovedForSale(event.approvalStatus);
    }

    const products = await tx.product.findMany({
      where: { id: { in: items.map((i) => i.productId) } },
      include: { shop: true },
    });
    if (products.length !== items.length) {
      throw new CheckoutError("One of those products no longer exists");
    }

    // Group the basket by shop: one order per shop, sharing a group reference.
    const byShop = new Map<
      string,
      { shopId: string; lines: { product: (typeof products)[number]; quantity: number }[] }
    >();

    for (const item of items) {
      const product = products.find((p) => p.id === item.productId)!;
      if (!product.active) throw new CheckoutError(`${product.name} is unavailable`);
      if (product.shop.status !== "ACTIVE") {
        throw new CheckoutError(`${product.shop.name} isn't open for orders`);
      }
      const bucket = byShop.get(product.shopId) ?? {
        shopId: product.shopId,
        lines: [],
      };
      bucket.lines.push({ product, quantity: item.quantity });
      byShop.set(product.shopId, bucket);
    }

    const shopIds = [...byShop.keys()];

    // A shop may only sell into an event it has an ACTIVE connection with.
    const connections = event
      ? await tx.connection.findMany({
          where: { eventId: event.id, shopId: { in: shopIds }, status: "ACTIVE" },
        })
      : [];

    if (event) {
      for (const shopId of shopIds) {
        if (!connections.find((c) => c.shopId === shopId)) {
          const shop = products.find((p) => p.shopId === shopId)!.shop;
          throw new CheckoutError(`${shop.name} isn't connected to this event`);
        }
      }
    }

    for (const bucket of byShop.values()) {
      for (const line of bucket.lines) {
        await reserveProductStock(tx, line.product.id, line.quantity);
      }
    }

    // Per-shop subtotals, computed from database prices.
    const shopTotals = shopIds.map((shopId) => {
      const bucket = byShop.get(shopId)!;
      const subtotal = bucket.lines.reduce(
        (a, l) => a + l.product.priceKobo * l.quantity,
        0,
      );
      return { shopId, subtotal, bucket };
    });

    const grandSubtotal = shopTotals.reduce((a, s) => a + s.subtotal, 0);
    // Product sales count against the event's cap alongside ticket revenue.
    if (event) await assertWithinCap(tx, event.id, grandSubtotal);

    const processingFeeBps = event?.processingFeeBps ?? 150;
    const totals = buyerTotal(grandSubtotal, payNow ? processingFeeBps : 0);

    // Spread the single buyer-paid processing fee across shops so per-shop
    // records still add up to the one amount the buyer was charged.
    const feeShares = allocate(
      totals.processingFeeKobo,
      shopTotals.map((s) => s.subtotal),
    );

    const counter = await tx.event.count();
    const groupRef = `EA-${Date.now().toString(36).toUpperCase().slice(-5)}${counter % 10}`;

    let payment: { id: string; reference: string } | null = null;
    if (payNow) {
      payment = await tx.payment.create({
        data: {
          reference: generatePaymentReference(),
          purpose: "ORDER",
          amountKobo: totals.totalKobo,
          subtotalKobo: totals.subtotalKobo,
          processingFeeKobo: totals.processingFeeKobo,
          status: "PENDING",
          buyerName: buyer.name,
          buyerEmail: buyer.email.toLowerCase(),
          buyerPhone: buyer.phone ?? null,
          userId: userId ?? null,
          eventId: event?.id ?? null,
          expiresAt: new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000),
        },
        select: { id: true, reference: true },
      });
    }

    const orderReferences: string[] = [];
    const multi = shopTotals.length > 1;

    for (const [index, entry] of shopTotals.entries()) {
      const connection = connections.find((c) => c.shopId === entry.shopId);
      const shop = entry.bucket.lines[0].product.shop;

      if (!payNow && !shop.payAtEvent) {
        throw new CheckoutError(`${shop.name} requires payment online`);
      }

      const reference = multi ? `${groupRef}-${index + 1}` : groupRef;
      orderReferences.push(reference);

      const order = await tx.order.create({
        data: {
          reference,
          groupRef,
          eventId: event?.id ?? null,
          shopId: entry.shopId,
          connectionId: connection?.id ?? null,
          buyerName: buyer.name,
          buyerEmail: buyer.email.toLowerCase(),
          buyerPhone: buyer.phone ?? null,
          userId: userId ?? null,
          subtotalKobo: entry.subtotal,
          processingFeeKobo: feeShares[index],
          totalKobo: entry.subtotal + feeShares[index],
          // Terms are frozen here. Editing the connection later cannot
          // retroactively change what this order pays out.
          serviceFeeBps: event?.serviceFeeBps ?? 750,
          revenueShareBps: connection?.revenueShareBps ?? 0,
          status: payNow ? "PENDING_PAYMENT" : "CREATED",
          paymentMethod: payNow ? "ONLINE" : "AT_EVENT",
          paymentId: payment?.id ?? null,
        },
      });

      for (const line of entry.bucket.lines) {
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: line.product.id,
            nameSnapshot: line.product.name,
            unitPriceKobo: line.product.priceKobo,
            quantity: line.quantity,
          },
        });
      }
    }

    return {
      paymentId: payment?.id ?? "",
      reference: payment?.reference ?? groupRef,
      amountKobo: totals.totalKobo,
      free: totals.totalKobo === 0,
      groupRef,
      orderReferences,
    };
  });
}

// ------------------------------------------------------------------
// Settlement — the only path that marks money as received
// ------------------------------------------------------------------

/**
 * Confirms a payment and writes its ledger entries. Idempotent: calling it
 * twice for the same reference (webhook retry, callback race) is a no-op the
 * second time, because the status transition is guarded by a conditional
 * update inside the transaction.
 */
export async function settlePayment(
  reference: string,
  rawPayload?: unknown,
): Promise<{ settled: boolean }> {
  const result = await db.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { reference },
      include: { event: true },
    });
    if (!payment) throw new CheckoutError(`Unknown payment reference ${reference}`);
    if (payment.status === "SUCCESS") return { settled: false, payment };

    // Guarded transition: only one caller can move PENDING -> SUCCESS.
    const claimed = await tx.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: {
        status: "SUCCESS",
        paidAt: new Date(),
        rawPayload: rawPayload ? (rawPayload as Prisma.InputJsonValue) : undefined,
      },
    });
    if (claimed.count === 0) return { settled: false, payment };

    if (payment.purpose === "TICKETS") {
      await settleTickets(tx, payment.id);
    } else {
      await settleOrders(tx, payment.id);
    }

    return { settled: true, payment };
  });

  if (result.settled) {
    await sendPostPaymentEmails(reference).catch((error) =>
      console.error("[commerce] post-payment email failed:", error),
    );
  }
  return { settled: result.settled };
}

async function settleTickets(tx: Tx, paymentId: string): Promise<void> {
  const tickets = await tx.ticket.findMany({
    where: { paymentId, status: "PENDING_PAYMENT" },
    include: { event: true },
  });
  if (tickets.length === 0) return;

  const counts = new Map<string, number>();
  for (const ticket of tickets) {
    counts.set(ticket.ticketTypeId, (counts.get(ticket.ticketTypeId) ?? 0) + 1);
  }
  for (const [ticketTypeId, qty] of counts) {
    await commitTicketInventory(tx, ticketTypeId, qty);
  }

  await tx.ticket.updateMany({
    where: { paymentId, status: "PENDING_PAYMENT" },
    data: { status: "VALID" },
  });

  const event = tickets[0].event;
  const gross = tickets.reduce((a, t) => a + t.pricePaidKobo, 0);
  if (gross === 0) return;

  const split = splitTicketSale(gross, event.serviceFeeBps);
  const lines = ledgerLinesForTickets({
    split,
    organiserUserId: event.organiserId,
    eventName: event.name,
  });

  await tx.ledgerEntry.createMany({
    data: lines.map((line) => ({
      account: line.account,
      amountKobo: line.amountKobo,
      partyId: line.partyId,
      paymentId,
      eventId: event.id,
      description: line.description,
    })),
  });
}

async function settleOrders(tx: Tx, paymentId: string): Promise<void> {
  const orders = await tx.order.findMany({
    where: { paymentId, status: "PENDING_PAYMENT" },
    include: { items: true, shop: true, event: true },
  });

  for (const order of orders) {
    for (const item of order.items) {
      await commitProductStock(tx, item.productId, item.quantity);
    }

    await tx.order.update({
      where: { id: order.id },
      data: { status: "PREPARING", paidAt: new Date() },
    });

    const split = splitSale({
      grossKobo: order.subtotalKobo,
      serviceFeeBps: order.serviceFeeBps,
      revenueShareBps: order.revenueShareBps,
    });

    const lines = ledgerLinesForOrder({
      split,
      vendorUserId: order.shop.ownerId,
      organiserUserId: order.event?.organiserId ?? null,
      orderReference: order.reference,
    });

    await tx.ledgerEntry.createMany({
      data: lines.map((line) => ({
        account: line.account,
        amountKobo: line.amountKobo,
        partyId: line.partyId,
        paymentId,
        orderId: order.id,
        eventId: order.eventId,
        shopId: order.shopId,
        description: line.description,
      })),
    });
  }
}

export async function failPayment(reference: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { reference } });
    if (!payment || payment.status !== "PENDING") return;

    await tx.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED" },
    });
    await releaseReservationsFor(tx, payment.id);
  });
}

async function releaseReservationsFor(tx: Tx, paymentId: string): Promise<void> {
  const tickets = await tx.ticket.findMany({
    where: { paymentId, status: "PENDING_PAYMENT" },
  });
  const counts = new Map<string, number>();
  for (const ticket of tickets) {
    counts.set(ticket.ticketTypeId, (counts.get(ticket.ticketTypeId) ?? 0) + 1);
  }
  for (const [ticketTypeId, qty] of counts) {
    await releaseTicketInventory(tx, ticketTypeId, qty);
  }
  await tx.ticket.updateMany({
    where: { paymentId, status: "PENDING_PAYMENT" },
    data: { status: "CANCELLED" },
  });

  const orders = await tx.order.findMany({
    where: { paymentId, status: "PENDING_PAYMENT" },
    include: { items: true },
  });
  for (const order of orders) {
    for (const item of order.items) {
      await releaseProductStock(tx, item.productId, item.quantity);
    }
    await tx.order.update({
      where: { id: order.id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
  }
}

/**
 * Frees inventory held by checkouts the buyer walked away from. Safe to run on
 * a schedule; it only touches payments already past their expiry.
 */
export async function releaseExpiredReservations(): Promise<number> {
  const expired = await db.payment.findMany({
    where: { status: "PENDING", expiresAt: { lt: new Date() } },
    select: { id: true, reference: true },
    take: 100,
  });

  for (const payment of expired) {
    await db.$transaction(async (tx) => {
      const claimed = await tx.payment.updateMany({
        where: { id: payment.id, status: "PENDING" },
        data: { status: "ABANDONED" },
      });
      if (claimed.count === 0) return;
      await releaseReservationsFor(tx, payment.id);
    });
  }
  return expired.length;
}

// ------------------------------------------------------------------
// Fulfilment
// ------------------------------------------------------------------

export async function advanceOrder(
  orderId: string,
  actorUserId: string,
  providedPickupCode?: string,
): Promise<{ status: string; pickupCode?: string }> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { shop: true },
  });
  if (!order) throw new CheckoutError("Order not found");
  if (order.shop.ownerId !== actorUserId) {
    throw new CheckoutError("You don't have access to that order");
  }

  if (order.status === "CREATED" || order.status === "PAID" || order.status === "PREPARING") {
    const pickupCode = order.pickupCode ?? generatePickupCode();
    await db.order.update({
      where: { id: orderId },
      data: { status: "READY", pickupCode, readyAt: new Date() },
    });

    if (order.buyerEmail) {
      await sendEmail({
        to: order.buyerEmail,
        ...pickupReadyEmail({
          buyerName: order.buyerName,
          shopName: order.shop.name,
          reference: order.reference,
          pickupCode,
        }),
      }).catch(() => {});
    }
    return { status: "READY", pickupCode };
  }

  if (order.status === "READY") {
    // PRD ORD-08: collection is gated on the code the buyer was issued.
    if (!providedPickupCode || providedPickupCode.trim().toUpperCase() !== order.pickupCode) {
      throw new CheckoutError("That pickup code doesn't match");
    }
    // An unpaid order must be settled at the counter before it can complete.
    if (order.paymentMethod === "AT_EVENT" && !order.paidAt) {
      await db.$transaction(async (tx) => {
        const items = await tx.orderItem.findMany({ where: { orderId } });
        for (const item of items) {
          await commitProductStock(tx, item.productId, item.quantity);
        }
        await tx.order.update({
          where: { id: orderId },
          data: { status: "COMPLETED", paidAt: new Date(), completedAt: new Date() },
        });

        const split = splitSale({
          grossKobo: order.subtotalKobo,
          serviceFeeBps: order.serviceFeeBps,
          revenueShareBps: order.revenueShareBps,
        });
        const full = await tx.order.findUnique({
          where: { id: orderId },
          include: { event: true, shop: true },
        });
        const lines = ledgerLinesForOrder({
          split,
          vendorUserId: order.shop.ownerId,
          organiserUserId: full?.event?.organiserId ?? null,
          orderReference: order.reference,
        });
        await tx.ledgerEntry.createMany({
          data: lines.map((line) => ({
            account: line.account,
            amountKobo: line.amountKobo,
            partyId: line.partyId,
            orderId: order.id,
            eventId: order.eventId,
            shopId: order.shopId,
            description: `${line.description} (paid at event)`,
          })),
        });
      });
      return { status: "COMPLETED" };
    }

    await db.order.update({
      where: { id: orderId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    return { status: "COMPLETED" };
  }

  throw new CheckoutError(`Order is already ${order.status.toLowerCase()}`);
}

// ------------------------------------------------------------------
// Check-in
// ------------------------------------------------------------------

export interface CheckInResult {
  ok: boolean;
  message: string;
  ticket?: {
    id: string;
    attendeeName: string;
    ticketTypeName: string;
    code: string;
    alreadyCheckedIn: boolean;
    checkedInAt: Date | null;
  };
}

export async function checkInTicket(params: {
  ticketId: string;
  eventId: string;
  actorUserId: string;
}): Promise<CheckInResult> {
  const { ticketId, eventId, actorUserId } = params;

  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
    include: { ticketType: true, event: true },
  });

  if (!ticket) return { ok: false, message: "Ticket not found" };
  if (ticket.eventId !== eventId) {
    return { ok: false, message: "That ticket is for a different event" };
  }
  if (ticket.event.organiserId !== actorUserId) {
    return { ok: false, message: "You don't run this event" };
  }
  if (ticket.status === "PENDING_PAYMENT") {
    return { ok: false, message: "That ticket was never paid for" };
  }
  if (ticket.status === "CANCELLED" || ticket.status === "REFUNDED") {
    return { ok: false, message: `Ticket ${ticket.status.toLowerCase()}` };
  }

  const base = {
    id: ticket.id,
    attendeeName: ticket.attendeeName,
    ticketTypeName: ticket.ticketType.name,
    code: ticket.code,
  };

  if (ticket.status === "CHECKED_IN") {
    return {
      ok: false,
      message: `Already checked in${
        ticket.checkedInAt
          ? ` at ${ticket.checkedInAt.toLocaleTimeString("en-NG", {
              hour: "2-digit",
              minute: "2-digit",
            })}`
          : ""
      }`,
      ticket: { ...base, alreadyCheckedIn: true, checkedInAt: ticket.checkedInAt },
    };
  }

  // Conditional update so a double-scan can never register twice.
  const claimed = await db.ticket.updateMany({
    where: { id: ticketId, status: "VALID" },
    data: { status: "CHECKED_IN", checkedInAt: new Date(), checkedInBy: actorUserId },
  });

  if (claimed.count === 0) {
    return { ok: false, message: "Already checked in", ticket: { ...base, alreadyCheckedIn: true, checkedInAt: null } };
  }

  return {
    ok: true,
    message: `${ticket.attendeeName} is in`,
    ticket: { ...base, alreadyCheckedIn: false, checkedInAt: new Date() },
  };
}

// ------------------------------------------------------------------
// Notifications
// ------------------------------------------------------------------

async function sendPostPaymentEmails(reference: string): Promise<void> {
  const payment = await db.payment.findUnique({
    where: { reference },
    include: {
      tickets: { include: { ticketType: true, event: true } },
      orders: { include: { shop: true, items: true } },
    },
  });
  if (!payment) return;

  const base = process.env.APP_URL || "http://localhost:3000";

  for (const ticket of payment.tickets) {
    await sendEmail({
      to: ticket.attendeeEmail,
      ...ticketEmail({
        attendeeName: ticket.attendeeName,
        eventName: ticket.event.name,
        venue: ticket.event.venue,
        startsAt: ticket.event.startsAt,
        ticketTypeName: ticket.ticketType.name,
        code: ticket.code,
        ticketUrl: ticketUrl(ticket.qrToken),
        organiserNote: ticket.event.organiserNote,
      }),
    });
  }

  for (const order of payment.orders) {
    if (!order.buyerEmail) continue;
    await sendEmail({
      to: order.buyerEmail,
      ...orderReceiptEmail({
        buyerName: order.buyerName,
        shopName: order.shop.name,
        reference: order.reference,
        items: order.items.map((i) => ({ name: i.nameSnapshot, quantity: i.quantity })),
        totalLabel: formatNaira(order.totalKobo),
        paid: true,
        orderUrl: `${base}/orders/${order.reference}`,
      }),
    });
  }
}

export type { PaymentStatus };
