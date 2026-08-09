import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type { VerificationLevel } from "@prisma/client";

import { db } from "./db";
import { nairaToKobo } from "./money";
import { generateOtpCode } from "./ids";

/**
 * The L0–L3 trust ladder (PRD §6.1, VRF-01…07).
 *
 * Each level raises the per-event revenue cap, unlocks capability, and speeds
 * up settlement. Caps exist to bound fraud exposure from sellers whose identity
 * nobody has checked yet.
 */

export class VerificationError extends Error {}

export type SettlementCadence = "POST_EVENT" | "DAILY";
export type ApprovalPolicy = "FREE_EVENTS_ONLY" | "ALL_EVENTS";

export interface LevelEntitlements {
  level: VerificationLevel;
  label: string;
  howToVerify: string;
  /** Maximum gross revenue for a single event. null means unlimited. */
  revenueCapKobo: number | null;
  canCreateShop: boolean;
  canConnectShop: boolean;
  /** Which event types skip admin review. */
  autoApproval: ApprovalPolicy;
  settlementCadence: SettlementCadence;
  badge: boolean;
  unlocks: string[];
}

/**
 * Cap values are PRD Decision #8, resolved 2026-08-08:
 * L0 ₦500k · L1 ₦1m · L2 ₦5m · L3 unlimited.
 *
 * These are business levers — ADM-03 wants them behind feature flags, so they
 * are read through `entitlementsFor()` rather than inlined at call sites.
 */
export const LEVELS: Record<VerificationLevel, LevelEntitlements> = {
  L0: {
    level: "L0",
    label: "Email verified",
    howToVerify: "Verify your email address",
    revenueCapKobo: nairaToKobo(500_000),
    canCreateShop: false,
    canConnectShop: false,
    autoApproval: "FREE_EVENTS_ONLY",
    settlementCadence: "POST_EVENT",
    badge: false,
    unlocks: [
      "Unlimited free events, published instantly",
      "Paid events after a quick admin review",
    ],
  },
  L1: {
    level: "L1",
    label: "Phone verified",
    howToVerify: "Verify your phone number by SMS code",
    revenueCapKobo: nairaToKobo(1_000_000),
    canCreateShop: true,
    canConnectShop: true,
    autoApproval: "ALL_EVENTS",
    settlementCadence: "POST_EVENT",
    badge: false,
    unlocks: [
      "Paid events publish instantly — no review",
      "Open a shop and connect it to events",
      "₦1m revenue per event",
    ],
  },
  L2: {
    level: "L2",
    label: "Identity verified",
    howToVerify: "Provide your BVN or NIN",
    revenueCapKobo: nairaToKobo(5_000_000),
    canCreateShop: true,
    canConnectShop: true,
    autoApproval: "ALL_EVENTS",
    settlementCadence: "DAILY",
    badge: false,
    unlocks: ["₦5m revenue per event", "Daily settlement instead of post-event"],
  },
  L3: {
    level: "L3",
    label: "Business verified",
    howToVerify: "Provide your CAC registration number and TIN",
    revenueCapKobo: null,
    canCreateShop: true,
    canConnectShop: true,
    autoApproval: "ALL_EVENTS",
    settlementCadence: "DAILY",
    badge: true,
    unlocks: [
      "Unlimited revenue",
      "Verified badge on your events and shops",
      "Daily settlement",
    ],
  },
};

export const LEVEL_ORDER: VerificationLevel[] = ["L0", "L1", "L2", "L3"];

export function entitlementsFor(level: VerificationLevel): LevelEntitlements {
  return LEVELS[level];
}

export function nextLevel(level: VerificationLevel): VerificationLevel | null {
  const index = LEVEL_ORDER.indexOf(level);
  return index >= 0 && index < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[index + 1] : null;
}

export function atLeast(level: VerificationLevel, minimum: VerificationLevel): boolean {
  return LEVEL_ORDER.indexOf(level) >= LEVEL_ORDER.indexOf(minimum);
}

// ------------------------------------------------------------------
// Sensitive data handling — PRD VRF-07 / NDPR
// ------------------------------------------------------------------

/**
 * BVN, NIN and TIN are sensitive personal data under NDPR. They are encrypted
 * with AES-256-GCM using a key held outside the database, so a database dump
 * alone does not expose them. Only the last four digits are ever stored or
 * displayed in the clear.
 */
function kycKey(): Buffer {
  const secret = process.env.KYC_SECRET;
  if (!secret) {
    throw new VerificationError(
      "KYC_SECRET is not set — refusing to handle identity data without it",
    );
  }
  // Derive a fixed-length key so the secret can be any length.
  return createHash("sha256").update(secret).digest();
}

export function encryptSensitive(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", kycKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(
    ":",
  );
}

/**
 * The single place identity data is decrypted. Deliberately narrow: call sites
 * are auditable, and nothing else in the codebase reads `encryptedPayload`.
 */
export function decryptSensitive(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new VerificationError("Malformed encrypted payload");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    kycKey(),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function last4(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.slice(-4);
}

// ------------------------------------------------------------------
// Revenue caps — VRF-05
// ------------------------------------------------------------------

/**
 * Gross revenue recognised against an event: ticket sales plus product sales
 * through its connected shops. Caps apply to the event as a whole, whether or
 * not individual shops are open.
 */
export async function eventGrossKobo(
  eventId: string,
  client: Pick<typeof db, "ticket" | "order"> = db,
): Promise<number> {
  const [tickets, orders] = await Promise.all([
    client.ticket.aggregate({
      // PENDING_PAYMENT counts too: seats held by an in-flight checkout must
      // not let a second buyer push the event past its cap.
      where: { eventId, status: { in: ["VALID", "CHECKED_IN", "PENDING_PAYMENT"] } },
      _sum: { pricePaidKobo: true },
    }),
    client.order.aggregate({
      where: {
        eventId,
        status: { notIn: ["CANCELLED", "REFUNDED"] },
        OR: [{ paidAt: { not: null } }, { status: "PENDING_PAYMENT" }],
      },
      _sum: { subtotalKobo: true },
    }),
  ]);
  return (tickets._sum.pricePaidKobo ?? 0) + (orders._sum.subtotalKobo ?? 0);
}

export interface CapCheck {
  capKobo: number | null;
  usedKobo: number;
  remainingKobo: number | null;
  wouldExceed: boolean;
}

export async function checkRevenueCap(
  eventId: string,
  incomingKobo: number,
  client: Pick<typeof db, "ticket" | "order" | "event"> = db,
): Promise<CapCheck> {
  const event = await client.event.findUnique({
    where: { id: eventId },
    select: { revenueCapKobo: true },
  });

  const capKobo = event?.revenueCapKobo ?? null;
  const usedKobo = await eventGrossKobo(eventId, client);

  if (capKobo === null) {
    return { capKobo: null, usedKobo, remainingKobo: null, wouldExceed: false };
  }

  const remainingKobo = Math.max(0, capKobo - usedKobo);
  return {
    capKobo,
    usedKobo,
    remainingKobo,
    wouldExceed: usedKobo + incomingKobo > capKobo,
  };
}

// ------------------------------------------------------------------
// Level progression
// ------------------------------------------------------------------

/**
 * Recomputes a user's level from their approved evidence. Levels are strictly
 * sequential: L2 without a verified phone stays at L1 until the phone lands.
 */
export async function recomputeLevel(userId: string): Promise<VerificationLevel> {
  const [user, approved] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { emailVerified: true, phoneVerified: true },
    }),
    db.verificationSubmission.findMany({
      where: { userId, status: "APPROVED" },
      select: { kind: true },
    }),
  ]);

  const kinds = new Set(approved.map((s) => s.kind));
  const hasIdentity = kinds.has("BVN") || kinds.has("NIN");
  const hasBusiness = kinds.has("CAC_TIN");

  let level: VerificationLevel = "L0";
  if (user.phoneVerified) level = "L1";
  if (level === "L1" && hasIdentity) level = "L2";
  if (level === "L2" && hasBusiness) level = "L3";

  await db.user.update({
    where: { id: userId },
    data: { verificationLevel: level, verificationBadge: level === "L3" },
  });

  return level;
}

// ------------------------------------------------------------------
// Phone verification (L1)
// ------------------------------------------------------------------

const PHONE_OTP_TTL_MINUTES = 10;
const PHONE_OTP_MAX_ATTEMPTS = 5;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function normalisePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  // Nigerian local format: 0801… becomes +234801…
  if (digits.startsWith("0")) return `+234${digits.slice(1)}`;
  if (digits.startsWith("234")) return `+${digits}`;
  return `+${digits}`;
}

export async function requestPhoneCode(rawPhone: string): Promise<void> {
  const phone = normalisePhone(rawPhone);
  if (phone.replace(/\D/g, "").length < 10) {
    throw new VerificationError("That doesn't look like a valid phone number");
  }

  const recent = await db.otpCode.count({
    where: {
      email: phone,
      channel: "PHONE",
      createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
    },
  });
  if (recent >= 5) {
    throw new VerificationError("Too many codes requested. Try again shortly.");
  }

  await db.otpCode.updateMany({
    where: { email: phone, channel: "PHONE", consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const code = generateOtpCode();
  await db.otpCode.create({
    data: {
      email: phone,
      channel: "PHONE",
      codeHash: sha256(code),
      expiresAt: new Date(Date.now() + PHONE_OTP_TTL_MINUTES * 60 * 1000),
    },
  });

  await sendSms(
    phone,
    `${code} is your Earnival verification code. It expires in 10 minutes.`,
  );
}

export async function verifyPhoneCode(
  userId: string,
  rawPhone: string,
  code: string,
): Promise<VerificationLevel> {
  const phone = normalisePhone(rawPhone);

  const record = await db.otpCode.findFirst({
    where: { email: phone, channel: "PHONE", consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!record) throw new VerificationError("Request a new code");
  if (record.expiresAt < new Date()) throw new VerificationError("That code expired");
  if (record.attempts >= PHONE_OTP_MAX_ATTEMPTS) {
    throw new VerificationError("Too many attempts. Request a new code.");
  }

  const expected = Buffer.from(record.codeHash);
  const supplied = Buffer.from(sha256(code.trim()));
  const matches =
    expected.length === supplied.length && timingSafeEqual(expected, supplied);

  if (!matches) {
    await db.otpCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    throw new VerificationError("That code isn't right");
  }

  await db.otpCode.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });

  await db.user.update({
    where: { id: userId },
    data: { phone, phoneVerified: new Date() },
  });

  await db.verificationSubmission.create({
    data: {
      userId,
      kind: "PHONE",
      targetLevel: "L1",
      last4: last4(phone),
      status: "APPROVED",
      reviewedAt: new Date(),
    },
  });

  return recomputeLevel(userId);
}

/**
 * SMS delivery. No provider is wired yet — Termii or Africa's Talking are the
 * usual Nigerian choices. Until one is configured the code is logged, which is
 * enough for development and for the console-transport story in the README.
 */
async function sendSms(phone: string, message: string): Promise<void> {
  if (process.env.TERMII_API_KEY) {
    try {
      const res = await fetch("https://api.ng.termii.com/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: phone,
          from: process.env.TERMII_SENDER_ID || "Earnival",
          sms: message,
          type: "plain",
          channel: "generic",
          api_key: process.env.TERMII_API_KEY,
        }),
      });
      if (res.ok) return;
      console.error("[sms] provider rejected the message");
    } catch {
      console.error("[sms] delivery failed");
    }
    throw new VerificationError("We couldn't send that code. Try again shortly.");
  }

  // Verification codes are credentials: printing them is a local-development
  // convenience only. A deployed instance without an SMS provider must fail
  // rather than write the code where anyone with log access can read it.
  const appUrl = process.env.APP_URL ?? "";
  const deployed =
    process.env.NODE_ENV === "production" ||
    (Boolean(appUrl) && !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(appUrl));

  if (deployed) {
    throw new VerificationError(
      "Phone verification isn't available right now. Please try again later.",
    );
  }

  console.log(
    `\n──────── SMS (console transport) ────────\nTo:  ${phone}\n${message}\n─────────────────────────────────────────\n`,
  );
}

// ------------------------------------------------------------------
// Identity & business submissions (L2, L3)
// ------------------------------------------------------------------

export async function submitIdentity(params: {
  userId: string;
  kind: "BVN" | "NIN";
  value: string;
}): Promise<void> {
  const digits = params.value.replace(/\D/g, "");
  // BVN and NIN are both 11 digits in Nigeria.
  if (digits.length !== 11) {
    throw new VerificationError(`A ${params.kind} is 11 digits`);
  }

  const outstanding = await db.verificationSubmission.count({
    where: { userId: params.userId, kind: params.kind, status: "PENDING" },
  });
  if (outstanding > 0) {
    throw new VerificationError("You already have a submission awaiting review");
  }

  await db.verificationSubmission.create({
    data: {
      userId: params.userId,
      kind: params.kind,
      targetLevel: "L2",
      last4: last4(digits),
      encryptedPayload: encryptSensitive(digits),
      status: "PENDING",
    },
  });
}

export async function submitBusiness(params: {
  userId: string;
  businessName: string;
  cacNumber: string;
  tin: string;
}): Promise<void> {
  if (params.businessName.trim().length < 2) {
    throw new VerificationError("Enter your registered business name");
  }
  if (params.cacNumber.trim().length < 5) {
    throw new VerificationError("Enter a valid CAC registration number");
  }
  if (params.tin.replace(/\D/g, "").length < 8) {
    throw new VerificationError("Enter a valid TIN");
  }

  const outstanding = await db.verificationSubmission.count({
    where: { userId: params.userId, kind: "CAC_TIN", status: "PENDING" },
  });
  if (outstanding > 0) {
    throw new VerificationError("You already have a submission awaiting review");
  }

  await db.verificationSubmission.create({
    data: {
      userId: params.userId,
      kind: "CAC_TIN",
      targetLevel: "L3",
      businessName: params.businessName.trim(),
      last4: last4(params.tin),
      encryptedPayload: encryptSensitive(
        JSON.stringify({ cac: params.cacNumber.trim(), tin: params.tin.trim() }),
      ),
      status: "PENDING",
    },
  });
}

export async function reviewSubmission(params: {
  submissionId: string;
  reviewerId: string;
  approve: boolean;
  rejectionReason?: string;
}): Promise<void> {
  const submission = await db.verificationSubmission.findUnique({
    where: { id: params.submissionId },
  });
  if (!submission) throw new VerificationError("Submission not found");
  if (submission.status !== "PENDING") {
    throw new VerificationError("That submission was already reviewed");
  }

  await db.verificationSubmission.update({
    where: { id: params.submissionId },
    data: {
      status: params.approve ? "APPROVED" : "REJECTED",
      reviewedById: params.reviewerId,
      reviewedAt: new Date(),
      rejectionReason: params.approve ? null : (params.rejectionReason ?? "Not accepted"),
    },
  });

  await recomputeLevel(submission.userId);
}
