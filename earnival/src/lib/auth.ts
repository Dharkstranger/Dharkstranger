import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";
import type { User } from "@prisma/client";

import { db } from "./db";
import { generateOpaqueToken, generateOtpCode } from "./ids";
import { sendEmail, signInCodeEmail } from "./mail";

const SESSION_COOKIE = "earnival_session";
const SESSION_TTL_DAYS = 30;
const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
/** Codes requested per email inside the window before we start refusing. */
const OTP_MAX_PER_WINDOW = 5;
const OTP_WINDOW_MINUTES = 15;

export class AuthError extends Error {}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

// ------------------------------------------------------------------
// Sessions
// ------------------------------------------------------------------

export async function createSession(userId: string): Promise<void> {
  const token = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.session.create({
    data: { userId, tokenHash: sha256(token), expiresAt },
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  if (!session) return null;

  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return session.user;
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Sign in to continue");
  return user;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  }
  jar.delete(SESSION_COOKIE);
}

// ------------------------------------------------------------------
// Passwordless sign-in
// ------------------------------------------------------------------

export async function requestSignInCode(rawEmail: string): Promise<void> {
  const email = normaliseEmail(rawEmail);

  const since = new Date(Date.now() - OTP_WINDOW_MINUTES * 60 * 1000);
  const recent = await db.otpCode.count({
    where: { email, createdAt: { gte: since } },
  });
  if (recent >= OTP_MAX_PER_WINDOW) {
    throw new AuthError("Too many codes requested. Try again in a few minutes.");
  }

  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  // Supersede any outstanding codes so only the newest one works.
  await db.otpCode.updateMany({
    where: { email, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  await db.otpCode.create({
    data: { email, codeHash: sha256(code), expiresAt },
  });

  await sendEmail({ to: email, ...signInCodeEmail(code) });
}

export async function verifySignInCode(
  rawEmail: string,
  code: string,
): Promise<User> {
  const email = normaliseEmail(rawEmail);

  const record = await db.otpCode.findFirst({
    where: { email, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!record) throw new AuthError("Request a new code");
  if (record.expiresAt < new Date()) throw new AuthError("That code expired");
  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    throw new AuthError("Too many attempts. Request a new code.");
  }

  if (!safeEqual(record.codeHash, sha256(code.trim()))) {
    await db.otpCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    throw new AuthError("That code isn't right");
  }

  await db.otpCode.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });

  const user = await db.user.upsert({
    where: { email },
    update: { emailVerified: new Date() },
    create: { email, emailVerified: new Date() },
  });

  await attachGuestPurchases(user.id, email);
  await createSession(user.id);
  return user;
}

/**
 * PRD ACC-06: a guest who bought without an account gets those tickets and
 * orders bound to their account the first time they sign in with the same
 * email.
 */
export async function attachGuestPurchases(
  userId: string,
  email: string,
): Promise<void> {
  await db.$transaction([
    db.ticket.updateMany({
      where: { attendeeEmail: email, userId: null },
      data: { userId },
    }),
    db.order.updateMany({
      where: { buyerEmail: email, userId: null },
      data: { userId },
    }),
  ]);
}
