import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";

import { ANALYTICS, track } from "@/lib/analytics";
import { getCurrentUser } from "@/lib/auth";

const VISITOR_COOKIE = "earnival_vid";

const schema = z.object({
  name: z.enum([
    ANALYTICS.eventViewed,
    ANALYTICS.ticketCheckoutStarted,
    ANALYTICS.shopViewed,
    ANALYTICS.productAdded,
    ANALYTICS.orderCheckoutStarted,
  ]),
  eventId: z.string().max(40).optional().nullable(),
  shopId: z.string().max(40).optional().nullable(),
});

/**
 * Client-side funnel beacon.
 *
 * The visitor id is a first-party, per-browser random value with no meaning
 * outside Earnival — enough to count unique openers of a link, not enough to
 * follow anyone anywhere.
 */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    // Never argue with a beacon; just drop it.
    return NextResponse.json({ ok: true });
  }

  const jar = await cookies();
  let visitorId = jar.get(VISITOR_COOKIE)?.value;
  if (!visitorId) {
    visitorId = randomUUID();
    jar.set(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
    });
  }

  const user = await getCurrentUser().catch(() => null);

  await track({
    name: parsed.data.name,
    eventId: parsed.data.eventId ?? null,
    shopId: parsed.data.shopId ?? null,
    visitorId,
    userId: user?.id ?? null,
  });

  return NextResponse.json({ ok: true });
}
