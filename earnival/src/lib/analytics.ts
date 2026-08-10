import { db } from "./db";

/**
 * First-party funnel telemetry.
 *
 * Every PRD requirement ending in "Telemetry" was unimplemented, which meant
 * launching with no way to answer the only questions that matter afterwards:
 * how many people opened the link, how many started checkout, how many
 * finished, and where the rest went.
 *
 * No third-party tracker, no cross-site identifier, no personal data in
 * properties — just enough to see the funnel.
 */

export const ANALYTICS = {
  eventViewed: "event.viewed",
  ticketCheckoutStarted: "ticket.checkout_started",
  ticketPurchased: "ticket.purchased",
  shopViewed: "shop.viewed",
  productAdded: "product.added_to_basket",
  orderCheckoutStarted: "order.checkout_started",
  orderPlaced: "order.placed",
  checkedIn: "gate.checked_in",
} as const;

export type AnalyticsName = (typeof ANALYTICS)[keyof typeof ANALYTICS];

/**
 * Records an event. Never throws and never blocks the caller — losing a
 * datapoint is always preferable to failing a purchase.
 */
export async function track(params: {
  name: AnalyticsName;
  eventId?: string | null;
  shopId?: string | null;
  visitorId?: string | null;
  userId?: string | null;
  properties?: Record<string, string | number | boolean | null>;
}): Promise<void> {
  try {
    await db.analyticsEvent.create({
      data: {
        name: params.name,
        eventId: params.eventId ?? null,
        shopId: params.shopId ?? null,
        visitorId: params.visitorId ?? null,
        userId: params.userId ?? null,
        properties: params.properties ?? undefined,
      },
    });
  } catch (error) {
    console.error("[analytics] dropped event:", error);
  }
}

export interface EventFunnel {
  views: number;
  checkoutsStarted: number;
  purchases: number;
  viewToCheckoutPct: number;
  checkoutToPurchasePct: number;
  viewToPurchasePct: number;
  uniqueVisitors: number;
}

/** The funnel for one event, from link open to ticket in hand. */
export async function eventFunnel(eventId: string): Promise<EventFunnel> {
  const [views, checkoutsStarted, purchases, distinctVisitors] = await Promise.all([
    db.analyticsEvent.count({ where: { eventId, name: ANALYTICS.eventViewed } }),
    db.analyticsEvent.count({
      where: { eventId, name: ANALYTICS.ticketCheckoutStarted },
    }),
    db.analyticsEvent.count({ where: { eventId, name: ANALYTICS.ticketPurchased } }),
    db.analyticsEvent.findMany({
      where: { eventId, name: ANALYTICS.eventViewed, visitorId: { not: null } },
      distinct: ["visitorId"],
      select: { visitorId: true },
    }),
  ]);

  const pct = (numerator: number, denominator: number) =>
    denominator === 0 ? 0 : Math.round((numerator / denominator) * 1000) / 10;

  return {
    views,
    checkoutsStarted,
    purchases,
    uniqueVisitors: distinctVisitors.length,
    viewToCheckoutPct: pct(checkoutsStarted, views),
    checkoutToPurchasePct: pct(purchases, checkoutsStarted),
    viewToPurchasePct: pct(purchases, views),
  };
}

/** Aged-off aggregation would live here; for now, drop raw rows past 24 months. */
export async function purgeOldAnalytics(): Promise<number> {
  const cutoff = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000);
  const { count } = await db.analyticsEvent.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return count;
}
