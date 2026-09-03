/**
 * Screenshot-capture setup.
 *
 * Mints real session tokens straight into the database and collects the IDs
 * the capture script needs to reach every authenticated surface. Local-only
 * tooling — it is never imported by the app.
 *
 * Usage: npx tsx scripts/capture-setup.ts
 */
import { createHash, randomBytes } from "node:crypto";

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function sessionFor(email: string): Promise<string> {
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  const token = randomBytes(32).toString("base64url");
  await db.session.create({
    data: {
      userId: user.id,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  return token;
}

async function main() {
  const event = await db.event.findFirstOrThrow({
    where: { slug: "gidi-groove" },
    include: { ticketTypes: true },
  });

  const ticket = await db.ticket.findFirstOrThrow({
    where: { eventId: event.id, status: "VALID" },
  });

  // A ticket nobody has scanned yet, so the capture script can drive a real
  // check-in and photograph the success state rather than an idle viewfinder.
  const unchecked = await db.ticket.findFirstOrThrow({
    where: { eventId: event.id, status: "VALID", checkedInAt: null },
  });

  const order = await db.order.findFirst({
    where: { status: { in: ["PAID", "PREPARING", "READY"] } },
    orderBy: { createdAt: "desc" },
  });

  const shop = await db.shop.findFirstOrThrow({ where: { slug: "amaras-grill" } });

  console.log(
    JSON.stringify(
      {
        organiserSession: await sessionFor("organiser@earnival.app"),
        vendorSession: await sessionFor("amara@earnival.app"),
        rookieSession: await sessionFor("rookie@earnival.app"),
        eventId: event.id,
        eventSlug: event.slug,
        shopSlug: shop.slug,
        ticketToken: ticket.qrToken,
        ticketCode: ticket.code,
        uncheckedCode: unchecked.code,
        orderReference: order?.reference ?? null,
      },
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
