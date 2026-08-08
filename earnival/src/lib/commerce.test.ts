import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { db } from "./db";
import {
  SoldOutError,
  createProductCheckout,
  createTicketCheckout,
  releaseExpiredReservations,
  settlePayment,
} from "./commerce";
import { nairaToKobo } from "./money";
import { verifyTicketToken } from "./qr";

/**
 * Integration tests against a real Postgres. These exist because the two
 * failures that actually cost money — overselling under load, and
 * double-crediting on a webhook retry — cannot be caught by unit tests on
 * pure functions.
 */

const RUN = `test-${Date.now().toString(36)}`;
let organiserId: string;
let vendorId: string;
let eventId: string;
let eventSlug: string;
let shopId: string;

beforeAll(async () => {
  const organiser = await db.user.create({
    data: { email: `${RUN}-organiser@test.local`, name: "Test Organiser" },
  });
  const vendor = await db.user.create({
    data: { email: `${RUN}-vendor@test.local`, name: "Test Vendor" },
  });
  organiserId = organiser.id;
  vendorId = vendor.id;

  eventSlug = `${RUN}-event`;
  const event = await db.event.create({
    data: {
      slug: eventSlug,
      name: "Concurrency Test Party",
      category: "Party",
      venue: "Landmark Beach, Lagos",
      startsAt: new Date(Date.now() + 7 * 864e5),
      status: "LIVE",
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
      name: "Test Grill",
      category: "Food & Drinks",
      ownerId: vendorId,
      status: "ACTIVE",
      payAtEvent: true,
    },
  });
  shopId = shop.id;

  await db.connection.create({
    data: {
      shopId,
      eventId,
      status: "ACTIVE",
      revenueShareBps: 500,
      requestedBy: vendorId,
    },
  });
});

afterAll(async () => {
  // Children first — foreign keys without cascade would otherwise block us.
  await db.ledgerEntry.deleteMany({ where: { OR: [{ eventId }, { shopId }] } });
  await db.orderItem.deleteMany({ where: { order: { shopId } } });
  await db.order.deleteMany({ where: { shopId } });
  await db.ticket.deleteMany({ where: { eventId } });
  await db.payment.deleteMany({ where: { eventId } });
  await db.connection.deleteMany({ where: { eventId } });
  await db.product.deleteMany({ where: { shopId } });
  await db.ticketType.deleteMany({ where: { eventId } });
  await db.shop.deleteMany({ where: { id: shopId } });
  await db.event.deleteMany({ where: { id: eventId } });
  await db.user.deleteMany({ where: { id: { in: [organiserId, vendorId] } } });
  await db.$disconnect();
});

describe("ticket inventory under concurrency", () => {
  it("never oversells the last seats when 40 buyers race for 5", async () => {
    const type = await db.ticketType.create({
      data: {
        eventId,
        name: "Race Ticket",
        priceKobo: nairaToKobo(15_000),
        quantity: 5,
      },
    });

    const attempts = Array.from({ length: 40 }, (_, i) =>
      createTicketCheckout({
        eventSlug,
        lines: [{ ticketTypeId: type.id, quantity: 1 }],
        buyer: { name: `Buyer ${i}`, email: `buyer${i}@test.local` },
      }),
    );

    const results = await Promise.allSettled(attempts);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(5);
    expect(rejected).toHaveLength(35);
    expect(
      rejected.every((r) => (r as PromiseRejectedResult).reason instanceof SoldOutError),
    ).toBe(true);

    const after = await db.ticketType.findUniqueOrThrow({ where: { id: type.id } });
    expect(after.sold + after.reserved).toBe(5);
    expect(after.sold + after.reserved).toBeLessThanOrEqual(after.quantity);
  });

  it("rejects a bulk request that exceeds what is left", async () => {
    const type = await db.ticketType.create({
      data: { eventId, name: "Bulk", priceKobo: nairaToKobo(1_000), quantity: 3 },
    });

    await expect(
      createTicketCheckout({
        eventSlug,
        lines: [{ ticketTypeId: type.id, quantity: 4 }],
        buyer: { name: "Greedy", email: "greedy@test.local" },
      }),
    ).rejects.toBeInstanceOf(SoldOutError);

    const after = await db.ticketType.findUniqueOrThrow({ where: { id: type.id } });
    expect(after.reserved).toBe(0);
  });
});

describe("product stock under concurrency", () => {
  it("never oversells stock", async () => {
    const product = await db.product.create({
      data: {
        shopId,
        name: "Suya Platter",
        priceKobo: nairaToKobo(6_500),
        stock: 4,
        sku: `${RUN}-SKU-1`,
      },
    });

    const results = await Promise.allSettled(
      Array.from({ length: 25 }, (_, i) =>
        createProductCheckout({
          eventSlug,
          items: [{ productId: product.id, quantity: 1 }],
          buyer: { name: `Eater ${i}`, email: `eater${i}@test.local` },
          payNow: true,
        }),
      ),
    );

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(4);

    const after = await db.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(after.reserved).toBeLessThanOrEqual(after.stock);
  });
});

describe("payment settlement", () => {
  it("issues tickets, writes a balanced ledger, and is idempotent", async () => {
    const type = await db.ticketType.create({
      data: {
        eventId,
        name: "Settle Ticket",
        priceKobo: nairaToKobo(20_000),
        quantity: 10,
      },
    });

    const checkout = await createTicketCheckout({
      eventSlug,
      lines: [{ ticketTypeId: type.id, quantity: 2 }],
      buyer: { name: "Chidera Umeh", email: "chidera@test.local" },
    });

    // Before payment the tickets are held, not valid.
    const held = await db.ticket.findMany({ where: { paymentId: checkout.paymentId } });
    expect(held).toHaveLength(2);
    expect(held.every((t) => t.status === "PENDING_PAYMENT")).toBe(true);

    const first = await settlePayment(checkout.reference);
    expect(first.settled).toBe(true);

    // A retried webhook must not double-credit anyone.
    const second = await settlePayment(checkout.reference);
    expect(second.settled).toBe(false);

    const settled = await db.ticket.findMany({ where: { paymentId: checkout.paymentId } });
    expect(settled.every((t) => t.status === "VALID")).toBe(true);

    const type2 = await db.ticketType.findUniqueOrThrow({ where: { id: type.id } });
    expect(type2.sold).toBe(2);
    expect(type2.reserved).toBe(0);

    const entries = await db.ledgerEntry.findMany({
      where: { paymentId: checkout.paymentId },
    });
    // Exactly one settlement's worth of entries, despite two calls.
    expect(entries).toHaveLength(2);

    const gross = nairaToKobo(40_000);
    expect(entries.reduce((a, e) => a + e.amountKobo, 0)).toBe(gross);

    const platform = entries.find((e) => e.partyId === null);
    expect(platform?.amountKobo).toBe(nairaToKobo(3_000)); // 7.5% of 40,000
    const organiser = entries.find((e) => e.partyId === organiserId);
    expect(organiser?.amountKobo).toBe(nairaToKobo(37_000));
  });

  it("splits a product sale between vendor, organiser and platform", async () => {
    const product = await db.product.create({
      data: {
        shopId,
        name: "Asun Tacos",
        priceKobo: nairaToKobo(10_000),
        stock: 50,
        sku: `${RUN}-SKU-2`,
      },
    });

    const checkout = await createProductCheckout({
      eventSlug,
      items: [{ productId: product.id, quantity: 1 }],
      buyer: { name: "Bolu Adeyemi", email: "bolu@test.local" },
      payNow: true,
    });

    await settlePayment(checkout.reference);

    const entries = await db.ledgerEntry.findMany({
      where: { paymentId: checkout.paymentId },
    });

    // This is the PRD §8 worked example, executed by the real system.
    const vendor = entries.find((e) => e.partyId === vendorId);
    const organiser = entries.find((e) => e.partyId === organiserId);
    const platform = entries.find((e) => e.partyId === null);

    expect(platform?.amountKobo).toBe(nairaToKobo(750));
    expect(organiser?.amountKobo).toBe(nairaToKobo(500));
    expect(vendor?.amountKobo).toBe(nairaToKobo(8_750));
    expect(entries.reduce((a, e) => a + e.amountKobo, 0)).toBe(nairaToKobo(10_000));

    const after = await db.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(after.stock).toBe(49);
    expect(after.reserved).toBe(0);
  });
});

describe("abandoned checkouts", () => {
  it("returns held seats to the pool once the reservation expires", async () => {
    const type = await db.ticketType.create({
      data: { eventId, name: "Expiry", priceKobo: nairaToKobo(5_000), quantity: 2 },
    });

    const checkout = await createTicketCheckout({
      eventSlug,
      lines: [{ ticketTypeId: type.id, quantity: 2 }],
      buyer: { name: "Ghost", email: "ghost@test.local" },
    });

    const held = await db.ticketType.findUniqueOrThrow({ where: { id: type.id } });
    expect(held.reserved).toBe(2);

    // Sold out while the reservation stands.
    await expect(
      createTicketCheckout({
        eventSlug,
        lines: [{ ticketTypeId: type.id, quantity: 1 }],
        buyer: { name: "Latecomer", email: "late@test.local" },
      }),
    ).rejects.toBeInstanceOf(SoldOutError);

    await db.payment.update({
      where: { reference: checkout.reference },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await releaseExpiredReservations();

    const freed = await db.ticketType.findUniqueOrThrow({ where: { id: type.id } });
    expect(freed.reserved).toBe(0);
    expect(freed.sold).toBe(0);

    // And the seats are buyable again.
    const retry = await createTicketCheckout({
      eventSlug,
      lines: [{ ticketTypeId: type.id, quantity: 1 }],
      buyer: { name: "Latecomer", email: "late@test.local" },
    });
    expect(retry.paymentId).toBeTruthy();
  });
});

describe("ticket QR tokens", () => {
  it("issues a verifiable token that resolves to its own ticket", async () => {
    const type = await db.ticketType.create({
      data: { eventId, name: "QR", priceKobo: 0, quantity: 5 },
    });
    const checkout = await createTicketCheckout({
      eventSlug,
      lines: [{ ticketTypeId: type.id, quantity: 1 }],
      buyer: { name: "Scanner", email: "scanner@test.local" },
    });
    const ticket = await db.ticket.findFirstOrThrow({
      where: { paymentId: checkout.paymentId },
    });

    expect(verifyTicketToken(ticket.qrToken)).toBe(ticket.id);
    // A tampered token is rejected outright.
    expect(verifyTicketToken(ticket.qrToken.slice(0, -2) + "xy")).toBeNull();
  });
});

describe("connection enforcement", () => {
  it("refuses to sell a shop's products into an event it isn't connected to", async () => {
    const otherEvent = await db.event.create({
      data: {
        slug: `${RUN}-other`,
        name: "Unconnected Event",
        category: "Party",
        venue: "Somewhere",
        startsAt: new Date(Date.now() + 864e5),
        status: "LIVE",
        organiserId,
      },
    });
    const product = await db.product.create({
      data: {
        shopId,
        name: "Zobo",
        priceKobo: nairaToKobo(1_500),
        stock: 10,
        sku: `${RUN}-SKU-3`,
      },
    });

    await expect(
      createProductCheckout({
        eventSlug: otherEvent.slug,
        items: [{ productId: product.id, quantity: 1 }],
        buyer: { name: "Nobody", email: "nobody@test.local" },
        payNow: true,
      }),
    ).rejects.toThrow(/isn't connected/);

    // Reservation must not leak when the checkout is rejected.
    const after = await db.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(after.reserved).toBe(0);

    await db.event.delete({ where: { id: otherEvent.id } });
  });
});
