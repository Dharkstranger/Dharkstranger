import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

import { releaseExpiredReservations } from "@/lib/commerce";
import { runSettlements } from "@/lib/settlement";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Scheduled maintenance: release abandoned checkouts, then pay everyone who is
 * due. Both operations are idempotent, so running this more often than
 * necessary is harmless — and missing a run only delays payouts, never loses
 * them.
 *
 * Protect it with `CRON_SECRET` and call it from Vercel Cron, GitHub Actions,
 * or any scheduler:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://…/api/cron/settle
 */
function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";

  const header = request.headers.get("authorization") ?? "";
  const supplied = header.replace(/^Bearer\s+/i, "");

  const a = Buffer.from(supplied);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const released = await releaseExpiredReservations();
  const settlements = await runSettlements();

  return NextResponse.json({
    releasedReservations: released,
    settlements: {
      considered: settlements.considered,
      settled: settlements.settled,
      totalKobo: settlements.totalKobo,
      skipped: settlements.skipped,
    },
  });
}

export async function GET(request: Request) {
  // Vercel Cron issues GETs; behave identically.
  return POST(request);
}
