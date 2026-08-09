import { db } from "./db";

/**
 * Rate limiting.
 *
 * The attack this exists to stop is inventory denial: a script can post to
 * /api/checkout/tickets in a loop, hold every seat in a 20-minute reservation,
 * and make a sold-out event out of nothing without ever paying. The same
 * endpoint pattern also lets someone burn your SMS budget through OTP requests.
 *
 * Counters live in Postgres rather than memory because serverless instances do
 * not share memory — an in-process limiter on Vercel counts each cold start
 * separately and stops almost nothing.
 */

export interface RateLimitRule {
  /** Distinct bucket name, e.g. "checkout". */
  scope: string;
  limit: number;
  windowSeconds: number;
}

export const RATE_LIMITS = {
  /** Starting a checkout holds inventory, so this is the tightest limit. */
  checkout: { scope: "checkout", limit: 10, windowSeconds: 300 },
  /** Sign-in and phone codes cost money to send. */
  otp: { scope: "otp", limit: 8, windowSeconds: 900 },
  /** Door staff scan fast; this only needs to stop scripted abuse. */
  checkin: { scope: "checkin", limit: 600, windowSeconds: 60 },
  /** Ticket lookup by email — throttled so it cannot enumerate addresses. */
  lookup: { scope: "lookup", limit: 5, windowSeconds: 900 },
  /** Uploads are expensive to store. */
  upload: { scope: "upload", limit: 30, windowSeconds: 3600 },
} as const satisfies Record<string, RateLimitRule>;

export class RateLimitError extends Error {
  constructor(
    message: string,
    readonly retryAfterSeconds: number,
  ) {
    super(message);
  }
}

/**
 * Best-effort client identity. Behind Vercel or any sane proxy the leftmost
 * x-forwarded-for entry is the real client; it is spoofable, so this is a
 * speed bump for casual abuse rather than a defence against a determined
 * attacker with a proxy pool.
 */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    "unknown"
  );
}

/**
 * Consumes one unit against a bucket. Throws RateLimitError when the bucket is
 * empty. Fails open on a database error: a limiter outage must not take
 * checkout down with it.
 */
export async function consume(
  rule: RateLimitRule,
  identifier: string,
): Promise<void> {
  const now = new Date();
  const windowStart = new Date(
    Math.floor(now.getTime() / (rule.windowSeconds * 1000)) * rule.windowSeconds * 1000,
  );
  const key = `${rule.scope}:${identifier}:${windowStart.getTime()}`;

  try {
    const record = await db.rateLimitCounter.upsert({
      where: { key },
      create: { key, count: 1, windowStart },
      update: { count: { increment: 1 } },
      select: { count: true },
    });

    if (record.count > rule.limit) {
      const retryAfter = Math.ceil(
        (windowStart.getTime() + rule.windowSeconds * 1000 - now.getTime()) / 1000,
      );
      throw new RateLimitError(
        "That's a lot of requests in a short time. Give it a minute and try again.",
        Math.max(1, retryAfter),
      );
    }
  } catch (error) {
    if (error instanceof RateLimitError) throw error;
    console.error("[rate-limit] counter unavailable, allowing request:", error);
  }
}

/** Convenience wrapper for route handlers. */
export async function limitRequest(
  rule: RateLimitRule,
  request: Request,
  extraKey?: string,
): Promise<void> {
  const identifier = extraKey ? `${clientKey(request)}:${extraKey}` : clientKey(request);
  await consume(rule, identifier);
}

/** Housekeeping — old windows are dead weight. */
export async function purgeExpiredCounters(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const { count } = await db.rateLimitCounter.deleteMany({
    where: { windowStart: { lt: cutoff } },
  });
  return count;
}
