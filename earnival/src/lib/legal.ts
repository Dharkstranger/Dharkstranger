import { createHash } from "node:crypto";

import { db } from "./db";

/**
 * Consent and policy versioning.
 *
 * NDPR requires consent to be *demonstrable* — you must be able to show who
 * agreed to what, and to which version. Bump these when the wording materially
 * changes; existing records keep pointing at the version the person actually
 * saw.
 */
export const POLICY_VERSIONS = {
  terms: "2026-08-10",
  privacy: "2026-08-10",
} as const;

/** The refund rules, in one place, so buyer-facing copy cannot drift. */
export const REFUND_SUMMARY = {
  headline: "Refunds come back to you in full.",
  points: [
    "If an event is cancelled, every ticket and paid order is refunded automatically — you don't need to ask.",
    "Organisers and vendors can refund an order at any point before you collect it.",
    "You get back what you paid, including the processing fee. Earnival absorbs the part the payment processor keeps.",
    "Once a ticket has been scanned at the gate, or an order collected, it can't be refunded in-app.",
    "Refunds return to the card or account you paid from, usually within 5–10 business days.",
  ],
} as const;

/**
 * IP addresses are personal data under NDPR, so only a salted hash is kept —
 * enough to show two consents came from the same place, not enough to
 * re-identify anyone.
 */
function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  const salt = process.env.AUTH_SECRET ?? "";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export async function recordConsent(params: {
  email: string;
  userId?: string | null;
  kinds: ("TERMS" | "PRIVACY" | "MARKETING" | "KYC_PROCESSING")[];
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  const email = params.email.trim().toLowerCase();
  const ipHash = hashIp(params.ip ?? null);

  await db.consentRecord.createMany({
    data: params.kinds.map((kind) => ({
      email,
      userId: params.userId ?? null,
      kind,
      documentVersion:
        kind === "TERMS"
          ? POLICY_VERSIONS.terms
          : kind === "PRIVACY"
            ? POLICY_VERSIONS.privacy
            : POLICY_VERSIONS.privacy,
      granted: true,
      ipHash,
      userAgent: params.userAgent?.slice(0, 300) ?? null,
    })),
  });
}

export async function hasConsented(
  email: string,
  kind: "TERMS" | "PRIVACY" | "MARKETING" | "KYC_PROCESSING",
): Promise<boolean> {
  const record = await db.consentRecord.findFirst({
    where: { email: email.trim().toLowerCase(), kind, granted: true },
    select: { id: true },
  });
  return Boolean(record);
}

/** Best-effort client IP, for the consent record only. */
export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip");
}
