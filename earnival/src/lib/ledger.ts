import { db } from "./db";

/**
 * A party's balance is the sum of their ledger entries — never a stored number
 * that could drift out of sync with the entries that justify it.
 */
export async function unsettledBalance(userId: string): Promise<number> {
  const result = await db.ledgerEntry.aggregate({
    where: { partyId: userId, settlementId: null },
    _sum: { amountKobo: true },
  });
  return result._sum.amountKobo ?? 0;
}

export async function lifetimeEarnings(userId: string): Promise<number> {
  const result = await db.ledgerEntry.aggregate({
    where: { partyId: userId },
    _sum: { amountKobo: true },
  });
  return result._sum.amountKobo ?? 0;
}

export interface EventMoney {
  ticketGrossKobo: number;
  ticketNetKobo: number;
  shopGrossKobo: number;
  organiserShareKobo: number;
  serviceFeeKobo: number;
}

/** Everything the organiser console needs about one event's money. */
export async function eventMoney(eventId: string): Promise<EventMoney> {
  const [ticketNet, organiserShare, serviceFee, shopGross, ticketGross] =
    await Promise.all([
      db.ledgerEntry.aggregate({
        where: { eventId, account: "ORGANISER_TICKET_NET" },
        _sum: { amountKobo: true },
      }),
      db.ledgerEntry.aggregate({
        where: { eventId, account: "ORGANISER_SHARE" },
        _sum: { amountKobo: true },
      }),
      db.ledgerEntry.aggregate({
        where: { eventId, account: "PLATFORM_SERVICE_FEE" },
        _sum: { amountKobo: true },
      }),
      db.order.aggregate({
        where: { eventId, paidAt: { not: null } },
        _sum: { subtotalKobo: true },
      }),
      db.ticket.aggregate({
        where: { eventId, status: { in: ["VALID", "CHECKED_IN"] } },
        _sum: { pricePaidKobo: true },
      }),
    ]);

  return {
    ticketGrossKobo: ticketGross._sum.pricePaidKobo ?? 0,
    ticketNetKobo: ticketNet._sum.amountKobo ?? 0,
    shopGrossKobo: shopGross._sum.subtotalKobo ?? 0,
    organiserShareKobo: organiserShare._sum.amountKobo ?? 0,
    serviceFeeKobo: serviceFee._sum.amountKobo ?? 0,
  };
}

export async function shopMoney(shopId: string) {
  const [net, gross] = await Promise.all([
    db.ledgerEntry.aggregate({
      where: { shopId, account: "VENDOR_NET" },
      _sum: { amountKobo: true },
    }),
    db.order.aggregate({
      where: { shopId, paidAt: { not: null } },
      _sum: { subtotalKobo: true },
    }),
  ]);
  return {
    netKobo: net._sum.amountKobo ?? 0,
    grossKobo: gross._sum.subtotalKobo ?? 0,
  };
}
