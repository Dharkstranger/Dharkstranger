import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { db } from "./db";
import {
  RevenueCapError,
  createProductCheckout,
  createTicketCheckout,
  checkInTicket,
  settlePayment,
} from "./commerce";
import { refundOrder, refundTickets, cancelEventAndRefundAll } from "./refunds";
import { runSettlements, MINIMUM_PAYOUT_KOBO } from "./settlement";
import { unsettledBalance } from "./ledger";
import { nairaToKobo } from "./money";
import {
  LEVELS,
  atLeast,
  decryptSensitive,
  encryptSensitive,
  entitlementsFor,
  last4,
  normalisePhone,
  recomputeLevel,
} from "./verification";

/**
 * Integration coverage for the three trust-and-money systems: the verification
 * ladder, refunds, and settlement. These run against a real Postgres because
 * the failure modes that matter — paying someone twice, refunding more than was
 * paid, selling past a cap — are all concurrency and state problems.
 */

const RUN = `trust-${Date.now().toString(36)}`;
let organiserId: string;
let vendorId: string;
let eventId: string;
let eventSlug: string;
let shopId: string;
let productId: string;

beforeAll(async () => {
  process.env.KYC_SECRET ||= "test-kyc-secret-for-vitest";

  const organiser = await db.user.create({
    data: {
      email: `${RUN}-org@test.local`,
      name: "Trust Organiser",
      verificationLevel: "L2",
      phoneVerified: new Date(),
      payoutAccounts: {
        create: {
          bankCode: "058",
          bankName: "GTB",
          accountNumber: "0000000001",
          accountName: "TRUST ORGANISER",
          verified: true,
          isDefault: true,
        },
      },
    },
  });
  const vendor = await db.user.create({
    data: {
      email: `${RUN}-vendor@test.local`,
      name: "Trust Vendor",
      verificationLevel: "L2",
      phoneVerified: new Date(),
      payoutAccounts: {
        create: {
          bankCode: "044",
          bankName: "Access",
          accountNumber: "0000000002",
          accountName: "TRUST VENDOR",
          verified: true,
          isDefault: true,
        },
      },
    },
  });
  organiserId = organiser.id;
  vendorId = vendor.id;

  eventSlug = `${RUN}-event`;
  const event = await db.event.create({
    data: {
      slug: eventSlug,
      name: "Trust Test Party",
      category: "Party",
      venue: "Lagos",
      startsAt: new Date(Date.now() + 7 * 864e5),
      endsAt: new Date(Date.now() + 7 * 864e5 + 6 * 3600e3),
      status: "LIVE",
      approvalStatus: "AUTO_APPROVED",
      revenueCapKobo: LEVELS.L2.revenueCapKobo,
      organiserId,
      serviceFeeBps: 750,
      processingFeeBps: 150,
      publishedAt: new Date(),
    },
  });
  eventId = event.id;

  const shop = await db.shop.create({
    data: {
      slug: `${RUN}-shop`,
      name: "Trust Grill",
      category: "Food & Drinks",
      ownerId: vendorId,
      status: "ACTIVE",
      payAtEvent: true,
    },
  });
  shopId = shop.id;

  await db.connection.create({
    data: { shopId, eventId, status: "ACTIVE", revenueShareBps: 500, requestedBy: vendorId },
  });

  const product = await db.product.create({
    data: {
      shopId,
      name: "Suya",
      priceKobo: nairaToKobo(10_000),
      stock: 100,
      sku: `${RUN}-SKU`,
    },
  });
  productId = product.id;
});

afterAll(async () => {
  // Tear down by owner rather than by id: several tests create their own
  // events, and a failure part-way through would otherwise leave orphans that
  // block the user delete.
  const owners = { in: [organiserId, vendorId] };
  const events = await db.event.findMany({
    where: { organiserId: owners },
    select: { id: true },
  });
  const eventIds = events.map((e) => e.id);

  await db.ledgerEntry.deleteMany({
    where: { OR: [{ eventId: { in: eventIds } }, { shopId }, { partyId: owners }] },
  });
  await db.refund.deleteMany({ where: { payment: { eventId: { in: eventIds } } } });
  await db.settlement.deleteMany({ where: { partyId: owners } });
  await db.orderItem.deleteMany({ where: { order: { shopId } } });
  await db.order.deleteMany({ where: { shopId } });
  await db.ticket.deleteMany({ where: { eventId: { in: eventIds } } });
  await db.payment.deleteMany({ where: { eventId: { in: eventIds } } });
  await db.connection.deleteMany({ where: { eventId: { in: eventIds } } });
  await db.product.deleteMany({ where: { shopId } });
  await db.ticketType.deleteMany({ where: { eventId: { in: eventIds } } });
  await db.shop.deleteMany({ where: { ownerId: owners } });
  await db.event.deleteMany({ where: { id: { in: eventIds } } });
  await db.verificationSubmission.deleteMany({ where: { userId: owners } });
  await db.payoutAccount.deleteMany({ where: { userId: owners } });
  await db.user.deleteMany({ where: { id: owners } });
  await db.$disconnect();
});

// ==================================================================
// Verification ladder
// ==================================================================

describe("verification ladder", () => {
  it("encrypts identity data reversibly and never in plaintext", () => {
    const bvn = "22123456789";
    const encrypted = encryptSensitive(bvn);

    expect(encrypted).not.toContain(bvn);
    expect(encrypted.split(":")).toHaveLength(3);
    expect(decryptSensitive(encrypted)).toBe(bvn);
  });

  it("produces a different ciphertext each time for the same input", () => {
    // A deterministic ciphertext would let anyone confirm a guessed BVN.
    const a = encryptSensitive("22123456789");
    const b = encryptSensitive("22123456789");
    expect(a).not.toBe(b);
    expect(decryptSensitive(a)).toBe(decryptSensitive(b));
  });

  it("rejects tampered ciphertext rather than returning garbage", () => {
    const encrypted = encryptSensitive("22123456789");
    const [iv, tag, data] = encrypted.split(":");
    const tampered = `${iv}:${tag}:${Buffer.from("evil").toString("base64")}`;
    expect(() => decryptSensitive(tampered)).toThrow();
  });

  it("exposes only the last four digits", () => {
    expect(last4("22123456789")).toBe("6789");
  });

  it("normalises Nigerian phone formats to E.164", () => {
    expect(normalisePhone("08012345678")).toBe("+2348012345678");
    expect(normalisePhone("2348012345678")).toBe("+2348012345678");
    expect(normalisePhone("+234 801 234 5678")).toBe("+2348012345678");
  });

  it("orders levels correctly", () => {
    expect(atLeast("L2", "L1")).toBe(true);
    expect(atLeast("L0", "L1")).toBe(false);
    expect(atLeast("L3", "L3")).toBe(true);
  });

  it("gates capability and cadence by level", () => {
    expect(entitlementsFor("L0").canCreateShop).toBe(false);
    expect(entitlementsFor("L1").canCreateShop).toBe(true);
    expect(entitlementsFor("L0").autoApproval).toBe("FREE_EVENTS_ONLY");
    expect(entitlementsFor("L1").autoApproval).toBe("ALL_EVENTS");
    expect(entitlementsFor("L1").settlementCadence).toBe("POST_EVENT");
    expect(entitlementsFor("L2").settlementCadence).toBe("DAILY");
    expect(entitlementsFor("L3").revenueCapKobo).toBeNull();
    expect(entitlementsFor("L2").revenueCapKobo).toBe(nairaToKobo(5_000_000));
  });

  it("will not skip a level when evidence arrives out of order", async () => {
    const user = await db.user.create({
      data: { email: `${RUN}-ladder@test.local`, verificationLevel: "L0" },
    });

    // Identity approved, but the phone was never verified.
    await db.verificationSubmission.create({
      data: { userId: user.id, kind: "BVN", targetLevel: "L2", status: "APPROVED" },
    });
    expect(await recomputeLevel(user.id)).toBe("L0");

    await db.user.update({
      where: { id: user.id },
      data: { phoneVerified: new Date() },
    });
    expect(await recomputeLevel(user.id)).toBe("L2");

    await db.verificationSubmission.create({
      data: { userId: user.id, kind: "CAC_TIN", targetLevel: "L3", status: "APPROVED" },
    });
    expect(await recomputeLevel(user.id)).toBe("L3");

    const badged = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(badged.verificationBadge).toBe(true);

    await db.verificationSubmission.deleteMany({ where: { userId: user.id } });
    await db.user.delete({ where: { id: user.id } });
  });
});

describe("revenue caps", () => {
  it("blocks a sale that would push the event past its cap", async () => {
    const capped = await db.event.create({
      data: {
        slug: `${RUN}-capped`,
        name: "Capped Event",
        category: "Party",
        venue: "Lagos",
        startsAt: new Date(Date.now() + 864e5),
        status: "LIVE",
        approvalStatus: "AUTO_APPROVED",
        // A deliberately tiny cap so the boundary is easy to hit.
        revenueCapKobo: nairaToKobo(30_000),
        organiserId,
      },
    });
    const type = await db.ticketType.create({
      data: {
        eventId: capped.id,
        name: "Entry",
        priceKobo: nairaToKobo(20_000),
        quantity: 100,
      },
    });

    // First sale sits under the cap.
    await createTicketCheckout({
      eventSlug: capped.slug,
      lines: [{ ticketTypeId: type.id, quantity: 1 }],
      buyer: { name: "First", email: "first@test.local" },
    });

    // Second would take it to ₦40,000 against a ₦30,000 cap.
    await expect(
      createTicketCheckout({
        eventSlug: capped.slug,
        lines: [{ ticketTypeId: type.id, quantity: 1 }],
        buyer: { name: "Second", email: "second@test.local" },
      }),
    ).rejects.toBeInstanceOf(RevenueCapError);

    await db.ticket.deleteMany({ where: { eventId: capped.id } });
    await db.payment.deleteMany({ where: { eventId: capped.id } });
    await db.ticketType.deleteMany({ where: { eventId: capped.id } });
    await db.event.delete({ where: { id: capped.id } });
  });

  it("refuses to sell an event still awaiting admin review", async () => {
    const pending = await db.event.create({
      data: {
        slug: `${RUN}-pending`,
        name: "Pending Event",
        category: "Party",
        venue: "Lagos",
        startsAt: new Date(Date.now() + 864e5),
        status: "LIVE",
        approvalStatus: "PENDING_REVIEW",
        revenueCapKobo: LEVELS.L0.revenueCapKobo,
        organiserId,
      },
    });
    const type = await db.ticketType.create({
      data: {
        eventId: pending.id,
        name: "Entry",
        priceKobo: nairaToKobo(5_000),
        quantity: 50,
      },
    });

    await expect(
      createTicketCheckout({
        eventSlug: pending.slug,
        lines: [{ ticketTypeId: type.id, quantity: 1 }],
        buyer: { name: "Eager", email: "eager@test.local" },
      }),
    ).rejects.toThrow(/awaiting review/i);

    await db.ticketType.deleteMany({ where: { eventId: pending.id } });
    await db.event.delete({ where: { id: pending.id } });
  });
});

// ==================================================================
// Refunds
// ==================================================================

describe("refunds", () => {
  it("reverses a paid order so every party nets to zero", async () => {
    const checkout = await createProductCheckout({
      eventSlug,
      items: [{ productId, quantity: 1 }],
      buyer: { name: "Refund Buyer", email: "refund1@test.local" },
      payNow: true,
    });
    await settlePayment(checkout.reference);

    const order = await db.order.findFirstOrThrow({
      where: { payment: { reference: checkout.reference } },
    });

    const vendorBefore = await unsettledBalance(vendorId);
    const organiserBefore = await unsettledBalance(organiserId);

    await refundOrder({
      orderId: order.id,
      reason: "BUYER_REQUEST",
      actorUserId: vendorId,
    });

    // Both sellers are back exactly where they started.
    expect(await unsettledBalance(vendorId)).toBe(vendorBefore - nairaToKobo(8_750));
    expect(await unsettledBalance(organiserId)).toBe(
      organiserBefore - nairaToKobo(500),
    );

    const entries = await db.ledgerEntry.findMany({ where: { orderId: order.id } });
    const vendorNet = entries
      .filter((e) => e.partyId === vendorId)
      .reduce((a, e) => a + e.amountKobo, 0);
    const organiserNet = entries
      .filter((e) => e.partyId === organiserId)
      .reduce((a, e) => a + e.amountKobo, 0);

    expect(vendorNet).toBe(0);
    expect(organiserNet).toBe(0);

    // Earnival is out exactly the processing fee it could not recover.
    const platformNet = entries
      .filter((e) => e.partyId === null)
      .reduce((a, e) => a + e.amountKobo, 0);
    expect(platformNet).toBe(-nairaToKobo(150));

    const refreshed = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(refreshed.status).toBe("REFUNDED");
  });

  it("puts stock back on a full refund", async () => {
    const before = await db.product.findUniqueOrThrow({ where: { id: productId } });

    const checkout = await createProductCheckout({
      eventSlug,
      items: [{ productId, quantity: 3 }],
      buyer: { name: "Stock Buyer", email: "refund2@test.local" },
      payNow: true,
    });
    await settlePayment(checkout.reference);

    const sold = await db.product.findUniqueOrThrow({ where: { id: productId } });
    expect(sold.stock).toBe(before.stock - 3);

    const order = await db.order.findFirstOrThrow({
      where: { payment: { reference: checkout.reference } },
    });
    await refundOrder({ orderId: order.id, reason: "VENDOR_UNABLE_TO_FULFIL", actorUserId: vendorId });

    const restored = await db.product.findUniqueOrThrow({ where: { id: productId } });
    expect(restored.stock).toBe(before.stock);
  });

  it("refuses to refund more than was paid", async () => {
    const checkout = await createProductCheckout({
      eventSlug,
      items: [{ productId, quantity: 1 }],
      buyer: { name: "Greedy", email: "refund3@test.local" },
      payNow: true,
    });
    await settlePayment(checkout.reference);
    const order = await db.order.findFirstOrThrow({
      where: { payment: { reference: checkout.reference } },
    });

    await expect(
      refundOrder({
        orderId: order.id,
        goodsKobo: nairaToKobo(50_000),
        reason: "BUYER_REQUEST",
        actorUserId: vendorId,
      }),
    ).rejects.toThrow(/still refundable/i);

    // A partial refund works, and a second one cannot exceed the remainder.
    await refundOrder({
      orderId: order.id,
      goodsKobo: nairaToKobo(4_000),
      reason: "BUYER_REQUEST",
      actorUserId: vendorId,
    });

    const partial = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(partial.status).toBe("PARTIALLY_REFUNDED");

    await expect(
      refundOrder({
        orderId: order.id,
        goodsKobo: nairaToKobo(7_000),
        reason: "BUYER_REQUEST",
        actorUserId: vendorId,
      }),
    ).rejects.toThrow(/still refundable/i);
  });

  it("refunds tickets, returns the seats, and blocks refunding after check-in", async () => {
    const type = await db.ticketType.create({
      data: {
        eventId,
        name: "Refundable",
        priceKobo: nairaToKobo(20_000),
        quantity: 10,
      },
    });

    const checkout = await createTicketCheckout({
      eventSlug,
      lines: [{ ticketTypeId: type.id, quantity: 2 }],
      buyer: { name: "Ticket Buyer", email: "refund4@test.local" },
    });
    await settlePayment(checkout.reference);

    const tickets = await db.ticket.findMany({
      where: { paymentId: checkout.paymentId },
    });
    expect((await db.ticketType.findUniqueOrThrow({ where: { id: type.id } })).sold).toBe(2);

    // Check one in — that one can no longer be refunded.
    await checkInTicket({
      ticketId: tickets[0].id,
      eventId,
      actorUserId: organiserId,
    });

    await expect(
      refundTickets({
        ticketIds: [tickets[0].id],
        reason: "BUYER_REQUEST",
        actorUserId: organiserId,
      }),
    ).rejects.toThrow(/checked in/i);

    // The un-scanned one refunds cleanly and its seat returns to the pool.
    await refundTickets({
      ticketIds: [tickets[1].id],
      reason: "BUYER_REQUEST",
      actorUserId: organiserId,
    });

    const after = await db.ticketType.findUniqueOrThrow({ where: { id: type.id } });
    expect(after.sold).toBe(1);

    const refunded = await db.ticket.findUniqueOrThrow({ where: { id: tickets[1].id } });
    expect(refunded.status).toBe("REFUNDED");
  });

  it("cancelling an event refunds every outstanding ticket and order", async () => {
    const doomed = await db.event.create({
      data: {
        slug: `${RUN}-doomed`,
        name: "Doomed Event",
        category: "Party",
        venue: "Lagos",
        startsAt: new Date(Date.now() + 864e5),
        status: "LIVE",
        approvalStatus: "AUTO_APPROVED",
        organiserId,
        serviceFeeBps: 750,
        processingFeeBps: 150,
      },
    });
    const type = await db.ticketType.create({
      data: {
        eventId: doomed.id,
        name: "Entry",
        priceKobo: nairaToKobo(10_000),
        quantity: 50,
      },
    });

    for (const email of ["a@test.local", "b@test.local"]) {
      const checkout = await createTicketCheckout({
        eventSlug: doomed.slug,
        lines: [{ ticketTypeId: type.id, quantity: 1 }],
        buyer: { name: email, email },
      });
      await settlePayment(checkout.reference);
    }

    const result = await cancelEventAndRefundAll({
      eventId: doomed.id,
      actorUserId: organiserId,
    });

    expect(result.ticketsRefunded).toBe(2);
    expect(result.failures).toHaveLength(0);

    const cancelled = await db.event.findUniqueOrThrow({ where: { id: doomed.id } });
    expect(cancelled.status).toBe("CANCELLED");

    const remaining = await db.ticket.count({
      where: { eventId: doomed.id, status: { in: ["VALID", "CHECKED_IN"] } },
    });
    expect(remaining).toBe(0);

    // The organiser keeps nothing from a cancelled event.
    const organiserEntries = await db.ledgerEntry.findMany({
      where: { eventId: doomed.id, partyId: organiserId },
    });
    expect(organiserEntries.reduce((a, e) => a + e.amountKobo, 0)).toBe(0);

    await db.ledgerEntry.deleteMany({ where: { eventId: doomed.id } });
    await db.refund.deleteMany({ where: { payment: { eventId: doomed.id } } });
    await db.ticket.deleteMany({ where: { eventId: doomed.id } });
    await db.payment.deleteMany({ where: { eventId: doomed.id } });
    await db.ticketType.deleteMany({ where: { eventId: doomed.id } });
    await db.event.delete({ where: { id: doomed.id } });
  });
});

// ==================================================================
// Settlement
// ==================================================================

describe("settlement", () => {
  it("pays a daily-cadence seller once and never twice", async () => {
    const payoutEvent = await db.event.create({
      data: {
        slug: `${RUN}-payout`,
        name: "Payout Event",
        category: "Party",
        venue: "Lagos",
        startsAt: new Date(Date.now() + 864e5),
        status: "LIVE",
        approvalStatus: "AUTO_APPROVED",
        organiserId,
        serviceFeeBps: 750,
        processingFeeBps: 150,
      },
    });
    const type = await db.ticketType.create({
      data: {
        eventId: payoutEvent.id,
        name: "Entry",
        priceKobo: nairaToKobo(50_000),
        quantity: 20,
      },
    });

    const checkout = await createTicketCheckout({
      eventSlug: payoutEvent.slug,
      lines: [{ ticketTypeId: type.id, quantity: 2 }],
      buyer: { name: "Payer", email: "payer@test.local" },
    });
    await settlePayment(checkout.reference);

    // The event runs and finishes; backdate the entries so the daily cadence
    // considers them due.
    await db.event.update({
      where: { id: payoutEvent.id },
      data: {
        startsAt: new Date(Date.now() - 2 * 864e5),
        endsAt: new Date(Date.now() - 864e5),
        status: "ENDED",
      },
    });
    await db.ledgerEntry.updateMany({
      where: { eventId: payoutEvent.id },
      data: { createdAt: new Date(Date.now() - 2 * 864e5) },
    });

    const balanceBefore = await unsettledBalance(organiserId);
    expect(balanceBefore).toBeGreaterThan(MINIMUM_PAYOUT_KOBO);

    const first = await runSettlements();
    expect(first.settled).toBeGreaterThan(0);

    const settlements = await db.settlement.findMany({
      where: { partyId: organiserId },
    });
    expect(settlements.length).toBe(1);
    expect(settlements[0].status).toBe("PAID");

    // The payable balance drops by exactly what was paid out. It does not go to
    // zero: same-day earnings are not yet due under the daily cadence, which is
    // the point of settling whole days rather than partial ones.
    expect(await unsettledBalance(organiserId)).toBe(
      balanceBefore - settlements[0].amountKobo,
    );
    // The backdated ticket sale is what got paid: ₦100,000 less 7.5%.
    expect(settlements[0].amountKobo).toBe(nairaToKobo(92_500));

    // A second run must not create another payout.
    const second = await runSettlements();
    const after = await db.settlement.findMany({ where: { partyId: organiserId } });
    expect(after.length).toBe(1);
    expect(second.skipped.some((s) => s.partyId === organiserId)).toBe(true);

    await db.ledgerEntry.deleteMany({ where: { eventId: payoutEvent.id } });
    await db.ticket.deleteMany({ where: { eventId: payoutEvent.id } });
    await db.payment.deleteMany({ where: { eventId: payoutEvent.id } });
    await db.ticketType.deleteMany({ where: { eventId: payoutEvent.id } });
    await db.settlement.deleteMany({ where: { partyId: organiserId } });
    await db.event.delete({ where: { id: payoutEvent.id } });
  });

  it("holds back payment when a refund has taken the balance negative", async () => {
    const loser = await db.user.create({
      data: {
        email: `${RUN}-loser@test.local`,
        verificationLevel: "L2",
        payoutAccounts: {
          create: {
            bankCode: "058",
            bankName: "GTB",
            accountNumber: "0000000009",
            accountName: "LOSER",
            verified: true,
            isDefault: true,
          },
        },
      },
    });

    // A sale, then a larger reversal — the sort of thing a chargeback causes.
    await db.ledgerEntry.createMany({
      data: [
        {
          account: "VENDOR_NET",
          amountKobo: nairaToKobo(5_000),
          partyId: loser.id,
          description: "sale",
          createdAt: new Date(Date.now() - 2 * 864e5),
        },
        {
          account: "VENDOR_NET",
          amountKobo: -nairaToKobo(9_000),
          partyId: loser.id,
          description: "refund reversal",
          createdAt: new Date(Date.now() - 2 * 864e5),
        },
      ],
    });

    expect(await unsettledBalance(loser.id)).toBeLessThan(0);

    await runSettlements();

    const settlements = await db.settlement.findMany({ where: { partyId: loser.id } });
    expect(settlements).toHaveLength(0);
    // The negative carries forward rather than being written off.
    expect(await unsettledBalance(loser.id)).toBeLessThan(0);

    await db.ledgerEntry.deleteMany({ where: { partyId: loser.id } });
    await db.payoutAccount.deleteMany({ where: { userId: loser.id } });
    await db.user.delete({ where: { id: loser.id } });
  });

  it("will not pay a seller who has no verified bank account", async () => {
    const unbanked = await db.user.create({
      data: { email: `${RUN}-unbanked@test.local`, verificationLevel: "L2" },
    });

    await db.ledgerEntry.create({
      data: {
        account: "VENDOR_NET",
        amountKobo: nairaToKobo(20_000),
        partyId: unbanked.id,
        description: "sale",
        createdAt: new Date(Date.now() - 2 * 864e5),
      },
    });

    const result = await runSettlements();
    const skip = result.skipped.find((s) => s.partyId === unbanked.id);
    expect(skip?.reason).toMatch(/bank account/i);

    // Earnings are untouched and still payable once an account is added.
    expect(await unsettledBalance(unbanked.id)).toBe(nairaToKobo(20_000));

    await db.ledgerEntry.deleteMany({ where: { partyId: unbanked.id } });
    await db.user.delete({ where: { id: unbanked.id } });
  });

  it("holds post-event earnings until the event has actually finished", async () => {
    const seller = await db.user.create({
      data: {
        email: `${RUN}-postevent@test.local`,
        // L1 settles post-event rather than daily.
        verificationLevel: "L1",
        payoutAccounts: {
          create: {
            bankCode: "058",
            bankName: "GTB",
            accountNumber: "0000000011",
            accountName: "POST EVENT",
            verified: true,
            isDefault: true,
          },
        },
      },
    });

    const future = await db.event.create({
      data: {
        slug: `${RUN}-future`,
        name: "Future Event",
        category: "Party",
        venue: "Lagos",
        startsAt: new Date(Date.now() + 30 * 864e5),
        endsAt: new Date(Date.now() + 30 * 864e5 + 6 * 3600e3),
        status: "LIVE",
        approvalStatus: "AUTO_APPROVED",
        organiserId: seller.id,
      },
    });

    await db.ledgerEntry.create({
      data: {
        account: "ORGANISER_TICKET_NET",
        amountKobo: nairaToKobo(100_000),
        partyId: seller.id,
        eventId: future.id,
        description: "advance ticket sales",
        createdAt: new Date(Date.now() - 2 * 864e5),
      },
    });

    const result = await runSettlements();
    expect(result.skipped.find((s) => s.partyId === seller.id)?.reason).toMatch(
      /nothing due/i,
    );
    expect(await db.settlement.count({ where: { partyId: seller.id } })).toBe(0);

    // Once the event is over, the same earnings become payable.
    await db.event.update({
      where: { id: future.id },
      data: {
        startsAt: new Date(Date.now() - 2 * 864e5),
        endsAt: new Date(Date.now() - 864e5),
        status: "ENDED",
      },
    });

    await runSettlements();
    expect(await db.settlement.count({ where: { partyId: seller.id } })).toBe(1);

    await db.ledgerEntry.deleteMany({ where: { partyId: seller.id } });
    await db.settlement.deleteMany({ where: { partyId: seller.id } });
    await db.event.delete({ where: { id: future.id } });
    await db.payoutAccount.deleteMany({ where: { userId: seller.id } });
    await db.user.delete({ where: { id: seller.id } });
  });
});
