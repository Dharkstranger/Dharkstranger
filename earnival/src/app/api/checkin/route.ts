import { NextResponse } from "next/server";
import { z } from "zod";

import { checkInTicket } from "@/lib/commerce";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { extractTokenFromScan, verifyTicketToken } from "@/lib/qr";
import { RATE_LIMITS, RateLimitError, limitRequest } from "@/lib/rate-limit";

const schema = z.object({
  eventId: z.string().min(1),
  /** Either a scanned QR payload or a hand-typed check-in code. */
  scanned: z.string().trim().min(1).optional(),
  code: z.string().trim().min(1).optional(),
  /**
   * Stable per-scan id. Lets the offline queue retry the same scan without
   * risking a double check-in when connectivity returns.
   */
  idempotencyKey: z.string().trim().min(8).max(100).optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Sign in first" }, { status: 401 });
  }

  // Generous — door staff scan fast — but enough to stop scripted probing of
  // check-in codes.
  try {
    await limitRequest(RATE_LIMITS.checkin, request, user.id);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } },
      );
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Malformed request" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success || (!parsed.data.scanned && !parsed.data.code)) {
    return NextResponse.json(
      { ok: false, message: "Nothing to check in" },
      { status: 400 },
    );
  }

  const { eventId, scanned, code, idempotencyKey } = parsed.data;

  if (idempotencyKey) {
    const seen = await db.idempotencyKey.findUnique({ where: { key: idempotencyKey } });
    if (seen) {
      return NextResponse.json(seen.responseBody ?? { ok: true, message: "Already recorded" });
    }
  }

  let ticketId: string | null = null;

  if (scanned) {
    const token = extractTokenFromScan(scanned);
    // A bad signature is rejected before any database work happens.
    if (token) ticketId = verifyTicketToken(token);
    if (!ticketId) {
      return NextResponse.json({ ok: false, message: "That code isn't a valid ticket" });
    }
  } else if (code) {
    const ticket = await db.ticket.findUnique({
      where: { code: code.toUpperCase() },
      select: { id: true },
    });
    if (!ticket) {
      return NextResponse.json({ ok: false, message: "No ticket with that code" });
    }
    ticketId = ticket.id;
  }

  const result = await checkInTicket({
    ticketId: ticketId!,
    eventId,
    actorUserId: user.id,
  });

  if (idempotencyKey) {
    await db.idempotencyKey
      .create({
        data: { key: idempotencyKey, scope: "checkin", responseBody: result as object },
      })
      .catch(() => {});
  }

  return NextResponse.json(result);
}
