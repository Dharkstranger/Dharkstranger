/**
 * Generates believable demo activity for product screenshots.
 *
 * Everything here goes through the real code paths — createTicketCheckout,
 * createProductCheckout, settlePayment — so the ledger, the organiser's
 * connection share and the vendor balances are all genuinely computed rather
 * than written in as flat numbers. Local-only tooling; never imported by the app.
 *
 * Usage: npx tsx scripts/demo-activity.ts
 */
import { PrismaClient } from "@prisma/client";

import { ANALYTICS, track } from "../src/lib/analytics";
import {
  createProductCheckout,
  createTicketCheckout,
  settlePayment,
} from "../src/lib/commerce";

const db = new PrismaClient();

const BUYERS = [
  { name: "Zainab Bello", email: "zainab@mail.com", phone: "+2348021110001" },
  { name: "Kelechi Obi", email: "kelechi@mail.com", phone: "+2348021110002" },
  { name: "Fola Adeyinka", email: "fola@mail.com", phone: "+2348021110003" },
  { name: "Nneka Eze", email: "nneka@mail.com", phone: "+2348021110004" },
  { name: "Ibrahim Musa", email: "ibrahim@mail.com", phone: "+2348021110005" },
  { name: "Tomi Balogun", email: "tomi@mail.com", phone: "+2348021110006" },
  { name: "Chisom Nwosu", email: "chisom@mail.com", phone: "+2348021110007" },
  { name: "Damilola Sanni", email: "dami@mail.com", phone: "+2348021110008" },
];

function pick<T>(list: T[], i: number): T {
  return list[i % list.length];
}

async function main() {
  const event = await db.event.findFirstOrThrow({
    where: { slug: "gidi-groove" },
    include: { ticketTypes: { orderBy: { priceKobo: "asc" } } },
  });

  const shop = await db.shop.findFirstOrThrow({
    where: { slug: "amaras-grill" },
    include: { products: true },
  });

  const [regular, vip] = event.ticketTypes;

  // ── Traffic on the event page, so the funnel has a shape ───────────────
  // Roughly the drop-off a real link produces: plenty of opens, fewer
  // checkout starts, fewer completions.
  let views = 0;
  for (let i = 0; i < 214; i += 1) {
    await track({
      name: ANALYTICS.eventViewed,
      eventId: event.id,
      visitorId: `visitor-${i}`,
    });
    views += 1;
  }
  for (let i = 0; i < 47; i += 1) {
    await track({
      name: ANALYTICS.ticketCheckoutStarted,
      eventId: event.id,
      visitorId: `visitor-${i}`,
    });
  }

  // ── Ticket sales ──────────────────────────────────────────────────────
  let ticketsSold = 0;
  for (let i = 0; i < 22; i += 1) {
    const buyer = pick(BUYERS, i);
    const vipBuy = i % 6 === 0;
    const type = vipBuy ? vip : regular;

    const checkout = await createTicketCheckout({
      eventSlug: event.slug,
      lines: [{ ticketTypeId: type.id, quantity: vipBuy ? 1 : 2 }],
      buyer: { ...buyer, email: `${i}.${buyer.email}` },
    });

    await settlePayment(checkout.reference, { sandbox: true });
    await track({
      name: ANALYTICS.ticketPurchased,
      eventId: event.id,
      visitorId: `visitor-${i}`,
    });
    ticketsSold += vipBuy ? 1 : 2;
  }

  // ── Shop sales through the connection ─────────────────────────────────
  // This is what produces the organiser's share of vendor revenue — the
  // number that does not exist for an organiser on any other rail.
  let orders = 0;
  for (let i = 0; i < 31; i += 1) {
    const buyer = pick(BUYERS, i + 3);
    const product = pick(shop.products, i);

    await track({ name: ANALYTICS.shopViewed, eventId: event.id, shopId: shop.id });

    const checkout = await createProductCheckout({
      eventSlug: event.slug,
      items: [{ productId: product.id, quantity: (i % 3) + 1 }],
      buyer: { ...buyer, email: `s${i}.${buyer.email}` },
      payNow: true,
    });

    await settlePayment(checkout.reference, { sandbox: true });
    await track({ name: ANALYTICS.orderPlaced, eventId: event.id, shopId: shop.id });
    orders += 1;
  }

  // ── Some of them collected ────────────────────────────────────────────
  const paid = await db.order.findMany({
    where: { shopId: shop.id, status: "PAID" },
    take: 12,
    orderBy: { createdAt: "asc" },
  });
  for (const [i, order] of paid.entries()) {
    const target = i < 5 ? "COMPLETED" : i < 9 ? "READY" : "PREPARING";
    await db.order.update({ where: { id: order.id }, data: { status: target } });
  }

  // ── Some guests through the gate ──────────────────────────────────────
  const valid = await db.ticket.findMany({
    where: { eventId: event.id, status: "VALID" },
    take: 14,
  });
  for (const ticket of valid) {
    await db.ticket.update({
      where: { id: ticket.id },
      data: { status: "CHECKED_IN", checkedInAt: new Date() },
    });
    await track({ name: ANALYTICS.checkedIn, eventId: event.id });
  }

  const ledger = await db.ledgerEntry.count();
  console.log(
    JSON.stringify(
      { views, ticketsSold, shopOrders: orders, checkedIn: valid.length, ledgerEntries: ledger },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
