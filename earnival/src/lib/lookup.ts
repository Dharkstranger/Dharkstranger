import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * "I've lost my ticket email."
 *
 * A guest buyer has no account, so there is nothing to sign into — but they do
 * control the email address the ticket was sent to. A short-lived signed token
 * mailed to that address proves the same thing without inventing an account.
 *
 * Stateless by design: the token carries the address and its own expiry, so
 * losing the link just means requesting another.
 */

const TTL_MINUTES = 30;

export class LookupError extends Error {}

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new LookupError("AUTH_SECRET is not set");
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function issueLookupToken(email: string): string {
  const normalised = email.trim().toLowerCase();
  const expiresAt = Date.now() + TTL_MINUTES * 60 * 1000;
  const payload = `${Buffer.from(normalised).toString("base64url")}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

/** Returns the email address if the token is authentic and unexpired. */
export function verifyLookupToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encodedEmail, expiresAtRaw, signature] = parts;
  const payload = `${encodedEmail}.${expiresAtRaw}`;

  const expected = Buffer.from(sign(payload));
  const supplied = Buffer.from(signature);
  if (expected.length !== supplied.length) return null;
  if (!timingSafeEqual(expected, supplied)) return null;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;

  try {
    return Buffer.from(encodedEmail, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

export function lookupUrl(token: string): string {
  const base = process.env.APP_URL || "http://localhost:3000";
  return `${base}/find/${token}`;
}
