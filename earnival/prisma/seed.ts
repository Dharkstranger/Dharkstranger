import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

import { generateTicketCode, generateSku, generatePaymentReference } from "../src/lib/ids";
import { issueTicketToken } from "../src/lib/qr";
import { nairaToKobo, splitTicketSale, ledgerLinesForTickets } from "../src/lib/money";

const db = new PrismaClient();

async function main() {
  console.log("Seeding Earnival…");

  // Clean slate, children first.
  await db.ledgerEntry.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.ticket.deleteMany();
  await db.payment.deleteMany();
  await db.connection.deleteMany();
  await db.product.deleteMany();
  await db.ticketType.deleteMany();
  await db.shop.deleteMany();
  await db.event.deleteMany();
  await db.session.deleteMany();
  await db.otpCode.deleteMany();
  await db.user.deleteMany();

  const organiser = await db.user.create({
    data: {
      email: "organiser@earnival.app",
      name: "Emeka Ugochukwu",
      phone: "+234 801 111 2222",
      emailVerified: new Date(),
    },
  });

  const amara = await db.user.create({
    data: {
      email: "amara@earnival.app",
      name: "Amara N.",
      phone: "+234 801 234 5678",
      emailVerified: new Date(),
    },
  });

  const tunde = await db.user.create({
    data: {
      email: "tunde@earnival.app",
      name: "Tunde A.",
      phone: "+234 802 000 1122",
      emailVerified: new Date(),
    },
  });

  const event = await db.event.create({
    data: {
      slug: "gidi-groove",
      name: "Gidi Groove — Detty December Block Party",
      category: "Party",
      description:
        "12 hours of live music, food and Lagos energy. Amapiano till mama calls.",
      venue: "Landmark Beach, Oniru, Lagos",
      startsAt: new Date("2026-12-19T14:00:00+01:00"),
      endsAt: new Date("2026-12-20T02:00:00+01:00"),
      organiserNote: "Gates open 2pm sharp. Bring a valid ID. No outside drinks.",
      status: "LIVE",
      publishedAt: new Date(),
      organiserId: organiser.id,
      ticketTypes: {
        create: [
          { name: "Regular", priceKobo: nairaToKobo(15_000), quantity: 500, sortOrder: 0 },
          { name: "VIP", priceKobo: nairaToKobo(40_000), quantity: 100, sortOrder: 1 },
        ],
      },
    },
    include: { ticketTypes: true },
  });

  const secondEvent = await db.event.create({
    data: {
      slug: "lagos-art-week",
      name: "Lagos Art Week — Opening Night",
      category: "Art & Exhibition",
      description: "Twenty galleries, one night. Wine, work and the people who made it.",
      venue: "Alliance Française, Ikoyi, Lagos",
      startsAt: new Date("2026-11-06T18:00:00+01:00"),
      status: "LIVE",
      publishedAt: new Date(),
      organiserId: organiser.id,
      ticketTypes: {
        create: [
          { name: "Standard", priceKobo: nairaToKobo(7_500), quantity: 300, sortOrder: 0 },
        ],
      },
    },
  });

  const grill = await db.shop.create({
    data: {
      slug: "amaras-grill",
      name: "Amara's Grill",
      description: "Suya, asun and cold drinks. Twelve years on the Lagos circuit.",
      category: "Food & Drinks",
      whatsapp: "+234 801 234 5678",
      payAtEvent: true,
      status: "ACTIVE",
      ownerId: amara.id,
      products: {
        create: [
          {
            name: "Suya Platter",
            priceKobo: nairaToKobo(6_500),
            stock: 40,
            emoji: "🍢",
            sku: generateSku("Amara's Grill", 1),
          },
          {
            name: "Asun Tacos (3)",
            priceKobo: nairaToKobo(4_000),
            stock: 55,
            emoji: "🌮",
            sku: generateSku("Amara's Grill", 2),
          },
          {
            name: "Chilled Zobo",
            priceKobo: nairaToKobo(1_500),
            stock: 120,
            emoji: "🧃",
            sku: generateSku("Amara's Grill", 3),
          },
        ],
      },
    },
  });

  const threads = await db.shop.create({
    data: {
      slug: "lagos-threads",
      name: "Lagos Threads",
      description: "Event merch and streetwear, printed in Yaba.",
      category: "Fashion",
      whatsapp: "+234 802 000 1122",
      payAtEvent: false,
      status: "ACTIVE",
      ownerId: tunde.id,
      products: {
        create: [
          {
            name: "Gidi Groove Tee",
            priceKobo: nairaToKobo(12_000),
            stock: 80,
            emoji: "👕",
            sku: generateSku("Lagos Threads", 1),
          },
          {
            name: "Bucket Hat",
            priceKobo: nairaToKobo(8_000),
            stock: 60,
            emoji: "🧢",
            sku: generateSku("Lagos Threads", 2),
          },
        ],
      },
    },
  });

  // One accepted connection, one still pending, so the console has both states.
  await db.connection.create({
    data: {
      shopId: grill.id,
      eventId: event.id,
      status: "ACTIVE",
      revenueShareBps: 500,
      requestedBy: amara.id,
      respondedAt: new Date(),
      boothName: "Food Row · Stand 4",
    },
  });

  await db.connection.create({
    data: {
      shopId: threads.id,
      eventId: event.id,
      status: "PENDING",
      revenueShareBps: 700,
      applicationFeeKobo: nairaToKobo(10_000),
      requestedBy: tunde.id,
    },
  });

  // A handful of real sold tickets, settled through the ledger so the
  // organiser console opens with believable numbers.
  const regular = event.ticketTypes.find((t) => t.name === "Regular")!;
  const vip = event.ticketTypes.find((t) => t.name === "VIP")!;

  const attendees = [
    { name: "Chidera Umeh", email: "chidera@mail.com", type: vip, checkedIn: true },
    { name: "Bolu Adeyemi", email: "bolu@mail.com", type: regular, checkedIn: false },
    { name: "Ify Okonkwo", email: "ify@mail.com", type: regular, checkedIn: false },
    { name: "Seyi Bankole", email: "seyi@mail.com", type: regular, checkedIn: true },
  ];

  const gross = attendees.reduce((a, x) => a + x.type.priceKobo, 0);
  const payment = await db.payment.create({
    data: {
      reference: generatePaymentReference(),
      purpose: "TICKETS",
      amountKobo: gross,
      subtotalKobo: gross,
      processingFeeKobo: 0,
      status: "SUCCESS",
      paidAt: new Date(),
      buyerName: "Seed buyers",
      buyerEmail: "seed@earnival.app",
      eventId: event.id,
    },
  });

  for (const attendee of attendees) {
    const id = randomUUID();
    await db.ticket.create({
      data: {
        id,
        code: generateTicketCode(event.slug),
        qrToken: issueTicketToken(id),
        eventId: event.id,
        ticketTypeId: attendee.type.id,
        paymentId: payment.id,
        attendeeName: attendee.name,
        attendeeEmail: attendee.email,
        pricePaidKobo: attendee.type.priceKobo,
        status: attendee.checkedIn ? "CHECKED_IN" : "VALID",
        checkedInAt: attendee.checkedIn ? new Date() : null,
      },
    });
    await db.ticketType.update({
      where: { id: attendee.type.id },
      data: { sold: { increment: 1 } },
    });
  }

  const split = splitTicketSale(gross, event.serviceFeeBps);
  await db.ledgerEntry.createMany({
    data: ledgerLinesForTickets({
      split,
      organiserUserId: organiser.id,
      eventName: event.name,
    }).map((line) => ({
      account: line.account,
      amountKobo: line.amountKobo,
      partyId: line.partyId,
      paymentId: payment.id,
      eventId: event.id,
      description: line.description,
    })),
  });

  console.log(`
✓ Seeded.

  Events   ${event.slug}, ${secondEvent.slug}
  Shops    ${grill.slug} (connected), ${threads.slug} (pending)
  Tickets  ${attendees.length} sold, 2 checked in

  Sign in as any of these — the 6-digit code prints in the server log:
    organiser@earnival.app   (organiser, owns both events)
    amara@earnival.app       (vendor, connected shop)
    tunde@earnival.app       (vendor, pending request)
`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
