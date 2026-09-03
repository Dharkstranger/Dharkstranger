import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { db } from "./db";
import { checkInTicket, createTicketCheckout, settlePayment } from "./commerce";
import { eventAccess, shopAccess, attachPendingInvitations } from "./permissions";
import { unsettledBalance } from "./ledger";
import { nairaToKobo } from "./money";
import { POLICY_VERSIONS, recordConsent, hasConsented } from "./legal";

/**
 * The event-day survival kit.
 *
 * The behaviours here are the ones that decide whether a real event works:
 * whether a second person can open the gate, whether a cohost's cut comes out
 * of the right pocket, and whether consent is actually demonstrable.
 */

const RUN = `team-${Date.now().toString(36)}`;
let organiserId: string;
let doorStaffId: string;
let cohostId: string;
let strangerId: string;
let vendorId: string;
let staffId: string;
let eventId: string;
let eventSlug: string;
let shopId: string;

beforeAll(async () => {
  const make = (label: string) =>
    db.user.create({
      data: { email: `${RUN}-${label}@test.local`, name: label, verificationLevel: "L2" },
    });

  const [organiser, door, cohost, stranger, vendor, staff] = await Promise.all([
    make("organiser"),
    make("door"),
    make("cohost"),
    make("stranger"),
    make("vendor"),
    make("staff"),
  ]);

  organiserId = organiser.id;
  doorStaffId = door.id;
  cohostId = cohost.id;
  strangerId = stranger.id;
  vendorId = vendor.id;
  staffId = staff.id;

  eventSlug = `${RUN}-event`;
  const event = await db.event.create({
    data: {
      slug: eventSlug,
      name: "Team Test Party",
      category: "Party",
      venue: "Lagos",
      startsAt: new Date(Date.now() + 5 * 864e5),
      status: "LIVE",
      approvalStatus: "AUTO_APPROVED",
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
      name: "Team Grill",
      category: "Food & Drinks",
      ownerId: vendorId,
      status: "ACTIVE",
    },
  });
  shopId = shop.id;
});

afterAll(async () => {
  const owners = {
    in: [organiserId, doorStaffId, cohostId, strangerId, vendorId, staffId],
  };
  await db.ledgerEntry.deleteMany({ where: { OR: [{ eventId }, { partyId: owners }] } });
  await db.analyticsEvent.deleteMany({ where: { eventId } });
  await db.consentRecord.deleteMany({ where: { email: { contains: RUN } } });
  await db.eventMember.deleteMany({ where: { eventId } });
  await db.shopMember.deleteMany({ where: { shopId } });
  await db.ticket.deleteMany({ where: { eventId } });
  await db.payment.deleteMany({ where: { eventId } });
  await db.ticketType.deleteMany({ where: { eventId } });
  await db.shop.deleteMany({ where: { id: shopId } });
  await db.event.deleteMany({ where: { id: eventId } });
  await db.user.deleteMany({ where: { id: owners } });
  await db.$disconnect();
});

describe("who can open the gate", () => {
  it("lets the organiser in and keeps strangers out", async () => {
    expect(
      (await eventAccess({ userId: organiserId, eventId, capability: "checkIn" })).allowed,
    ).toBe(true);
    expect(
      (await eventAccess({ userId: strangerId, eventId, capability: "checkIn" })).allowed,
    ).toBe(false);
  });

  it("grants door duty only once the invitation is accepted", async () => {
    const member = await db.eventMember.create({
      data: {
        eventId,
        userId: doorStaffId,
        inviteEmail: `${RUN}-door@test.local`,
        role: "DOOR_STAFF",
        status: "PENDING",
        canCheckIn: true,
        invitedById: organiserId,
      },
    });

    // A pending invitation is not access.
    expect(
      (await eventAccess({ userId: doorStaffId, eventId, capability: "checkIn" })).allowed,
    ).toBe(false);

    await db.eventMember.update({
      where: { id: member.id },
      data: { status: "ACCEPTED" },
    });

    const access = await eventAccess({
      userId: doorStaffId,
      eventId,
      capability: "checkIn",
    });
    expect(access.allowed).toBe(true);
    expect(access.isOwner).toBe(false);
  });

  it("does not let door staff see the money", async () => {
    expect(
      (await eventAccess({ userId: doorStaffId, eventId, capability: "editEvent" }))
        .allowed,
    ).toBe(false);
    expect(
      (await eventAccess({ userId: doorStaffId, eventId, capability: "refund" })).allowed,
    ).toBe(false);
  });

  it("actually checks a guest in through a second person's account", async () => {
    const type = await db.ticketType.create({
      data: { eventId, name: "Gate", priceKobo: nairaToKobo(5_000), quantity: 10 },
    });
    const checkout = await createTicketCheckout({
      eventSlug,
      lines: [{ ticketTypeId: type.id, quantity: 1 }],
      buyer: { name: "Guest", email: "guest@test.local" },
    });
    await settlePayment(checkout.reference);
    const ticket = await db.ticket.findFirstOrThrow({
      where: { paymentId: checkout.paymentId },
    });

    // This is the whole point: not the organiser, and it works.
    const result = await checkInTicket({
      ticketId: ticket.id,
      eventId,
      actorUserId: doorStaffId,
    });
    expect(result.ok).toBe(true);

    const after = await db.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(after.status).toBe("CHECKED_IN");
    expect(after.checkedInBy).toBe(doorStaffId);
  });

  it("refuses a revoked member", async () => {
    await db.eventMember.updateMany({
      where: { eventId, userId: doorStaffId },
      data: { status: "REVOKED" },
    });
    expect(
      (await eventAccess({ userId: doorStaffId, eventId, capability: "checkIn" })).allowed,
    ).toBe(false);
  });
});

describe("shop staff", () => {
  it("gates each capability independently", async () => {
    await db.shopMember.create({
      data: {
        shopId,
        userId: staffId,
        inviteEmail: `${RUN}-staff@test.local`,
        status: "ACCEPTED",
        canCreateOrders: true,
        canFulfilOrders: true,
        canEditProducts: false,
        canRefund: false,
        invitedById: vendorId,
      },
    });

    expect(
      (await shopAccess({ userId: staffId, shopId, capability: "fulfilOrders" })).allowed,
    ).toBe(true);
    expect(
      (await shopAccess({ userId: staffId, shopId, capability: "editProducts" })).allowed,
    ).toBe(false);
    expect(
      (await shopAccess({ userId: staffId, shopId, capability: "refund" })).allowed,
    ).toBe(false);
    expect(
      (await shopAccess({ userId: strangerId, shopId, capability: "fulfilOrders" }))
        .allowed,
    ).toBe(false);
  });
});

describe("invitations that predate an account", () => {
  it("binds to the account that proves it owns the address", async () => {
    const email = `${RUN}-future@test.local`;
    await db.eventMember.create({
      data: {
        eventId,
        inviteEmail: email,
        userId: null,
        status: "PENDING",
        canCheckIn: true,
        invitedById: organiserId,
      },
    });

    const newcomer = await db.user.create({ data: { email } });
    await attachPendingInvitations(newcomer.id, email);

    const bound = await db.eventMember.findFirstOrThrow({
      where: { eventId, inviteEmail: email },
    });
    expect(bound.userId).toBe(newcomer.id);

    await db.eventMember.deleteMany({ where: { inviteEmail: email } });
    await db.user.delete({ where: { id: newcomer.id } });
  });
});

describe("cohost revenue", () => {
  it("pays a percentage cohost out of the organiser's pocket, not the vendor's", async () => {
    await db.eventMember.create({
      data: {
        eventId,
        userId: cohostId,
        inviteEmail: `${RUN}-cohost@test.local`,
        role: "COHOST",
        status: "ACCEPTED",
        canCheckIn: true,
        earns: true,
        shareType: "PERCENT",
        shareBps: 1000, // 10%
        revenueLine: "TICKET_SALES",
        invitedById: organiserId,
      },
    });

    const type = await db.ticketType.create({
      data: { eventId, name: "Cohost", priceKobo: nairaToKobo(100_000), quantity: 10 },
    });
    const checkout = await createTicketCheckout({
      eventSlug,
      lines: [{ ticketTypeId: type.id, quantity: 1 }],
      buyer: { name: "Buyer", email: "cohostbuyer@test.local" },
    });

    const organiserBefore = await unsettledBalance(organiserId);
    await settlePayment(checkout.reference);

    const entries = await db.ledgerEntry.findMany({
      where: { paymentId: checkout.paymentId },
    });

    // ₦100,000 gross, 7.5% service charge, so the organiser's line is ₦92,500.
    // The cohost's 10% of that is ₦9,250.
    const cohostCredit = entries.find(
      (e) => e.partyId === cohostId && e.account === "COHOST_SHARE",
    );
    expect(cohostCredit?.amountKobo).toBe(nairaToKobo(9_250));

    // The organiser carries the cost — the platform's cut is untouched.
    const organiserAfter = await unsettledBalance(organiserId);
    expect(organiserAfter - organiserBefore).toBe(
      nairaToKobo(92_500) - nairaToKobo(9_250),
    );

    const platform = entries
      .filter((e) => e.partyId === null)
      .reduce((a, e) => a + e.amountKobo, 0);
    expect(platform).toBe(nairaToKobo(7_500));

    // And the ledger still balances to the gross.
    expect(entries.reduce((a, e) => a + e.amountKobo, 0)).toBe(nairaToKobo(100_000));
  });

  it("pays a flat cohost fee once, not on every ticket", async () => {
    const flatCohost = await db.user.create({
      data: { email: `${RUN}-flat@test.local`, verificationLevel: "L2" },
    });
    await db.eventMember.create({
      data: {
        eventId,
        userId: flatCohost.id,
        inviteEmail: `${RUN}-flat@test.local`,
        role: "COHOST",
        status: "ACCEPTED",
        earns: true,
        shareType: "FLAT",
        shareFlatKobo: nairaToKobo(20_000),
        revenueLine: "TICKET_SALES",
        invitedById: organiserId,
      },
    });

    const type = await db.ticketType.create({
      data: { eventId, name: "Flat", priceKobo: nairaToKobo(80_000), quantity: 10 },
    });

    for (const email of ["flat1@test.local", "flat2@test.local"]) {
      const checkout = await createTicketCheckout({
        eventSlug,
        lines: [{ ticketTypeId: type.id, quantity: 1 }],
        buyer: { name: email, email },
      });
      await settlePayment(checkout.reference);
    }

    const credits = await db.ledgerEntry.findMany({
      where: { eventId, partyId: flatCohost.id, account: "COHOST_SHARE" },
    });

    // Two sales, one flat fee — otherwise ₦20,000 would be owed per ticket.
    expect(credits).toHaveLength(1);
    expect(credits[0].amountKobo).toBe(nairaToKobo(20_000));

    await db.ledgerEntry.deleteMany({ where: { partyId: flatCohost.id } });
    await db.eventMember.deleteMany({ where: { userId: flatCohost.id } });
    await db.user.delete({ where: { id: flatCohost.id } });
  });

  it("never pays a cohost more than the organiser earned", async () => {
    const greedy = await db.user.create({
      data: { email: `${RUN}-greedy@test.local`, verificationLevel: "L2" },
    });
    await db.eventMember.create({
      data: {
        eventId,
        userId: greedy.id,
        inviteEmail: `${RUN}-greedy@test.local`,
        role: "COHOST",
        status: "ACCEPTED",
        earns: true,
        shareType: "FLAT",
        // Far more than any single sale will produce.
        shareFlatKobo: nairaToKobo(10_000_000),
        revenueLine: "TICKET_SALES",
        invitedById: organiserId,
      },
    });

    const type = await db.ticketType.create({
      data: { eventId, name: "Small", priceKobo: nairaToKobo(1_000), quantity: 5 },
    });
    const checkout = await createTicketCheckout({
      eventSlug,
      lines: [{ ticketTypeId: type.id, quantity: 1 }],
      buyer: { name: "Small", email: "small@test.local" },
    });
    await settlePayment(checkout.reference);

    const entries = await db.ledgerEntry.findMany({
      where: { paymentId: checkout.paymentId },
    });

    // The 10% cohost from the previous test is still on this event, so this
    // also proves several cohosts share the same pot without overdrawing it.
    const organiserNet = nairaToKobo(1_000) - Math.round(nairaToKobo(1_000) * 0.075);
    const percentCut = Math.round((organiserNet * 1000) / 10_000);

    const greedyCredit = entries.find(
      (e) => e.partyId === greedy.id && e.amountKobo > 0,
    );
    // Capped at whatever the earlier cohost left behind, not the flat amount.
    expect(greedyCredit?.amountKobo).toBe(organiserNet - percentCut);

    const cohostTotal = entries
      .filter((e) => e.account === "COHOST_SHARE" && e.amountKobo > 0)
      .reduce((a, e) => a + e.amountKobo, 0);
    // Cohosts between them can take the organiser's whole line, never more.
    expect(cohostTotal).toBeLessThanOrEqual(organiserNet);
    expect(cohostTotal).toBe(organiserNet);

    // The organiser is left at zero for this sale, not negative.
    const organiserLine = entries
      .filter((e) => e.partyId === organiserId)
      .reduce((a, e) => a + e.amountKobo, 0);
    expect(organiserLine).toBe(0);

    // And the whole thing still reconciles to the gross.
    expect(entries.reduce((a, e) => a + e.amountKobo, 0)).toBe(nairaToKobo(1_000));

    await db.ledgerEntry.deleteMany({ where: { partyId: greedy.id } });
    await db.eventMember.deleteMany({ where: { userId: greedy.id } });
    await db.user.delete({ where: { id: greedy.id } });
  });
});

describe("consent is demonstrable", () => {
  it("records what was agreed, to which version, without storing a raw IP", async () => {
    const email = `${RUN}-consent@test.local`;
    await recordConsent({
      email,
      kinds: ["TERMS", "PRIVACY"],
      ip: "102.89.23.11",
      userAgent: "Mozilla/5.0",
    });

    expect(await hasConsented(email, "TERMS")).toBe(true);
    expect(await hasConsented(email, "PRIVACY")).toBe(true);
    expect(await hasConsented(email, "MARKETING")).toBe(false);

    const record = await db.consentRecord.findFirstOrThrow({
      where: { email, kind: "TERMS" },
    });
    expect(record.documentVersion).toBe(POLICY_VERSIONS.terms);
    expect(record.ipHash).not.toContain("102.89");
    expect(record.ipHash).toHaveLength(32);
  });
});
