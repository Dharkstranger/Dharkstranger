import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Paystack integration.
 *
 * The critical rule this module exists to enforce: a payment is only ever
 * marked successful by (a) a signature-verified webhook, or (b) a server-side
 * verify call against Paystack's API. Nothing the client sends can move money
 * state — the prototype's `paid: true` from the browser is exactly the hole
 * this closes.
 *
 * Without credentials the module runs in SANDBOX mode so the full purchase loop
 * is testable locally. Sandbox refuses to engage when NODE_ENV=production.
 */

const API = "https://api.paystack.co";

export function isLive(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
}

export function isSandbox(): boolean {
  return !isLive() && process.env.NODE_ENV !== "production";
}

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new PaystackError("PAYSTACK_SECRET_KEY is not configured");
  return key;
}

export class PaystackError extends Error {}

/** Guards startup: a production deploy without payment keys is a broken deploy. */
export function assertPaymentsConfigured(): void {
  if (process.env.NODE_ENV === "production" && !isLive()) {
    throw new PaystackError(
      "PAYSTACK_SECRET_KEY must be set in production — refusing to run with simulated payments",
    );
  }
}

export interface InitializeParams {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}

export interface InitializeResult {
  authorizationUrl: string;
  accessCode: string | null;
  reference: string;
}

export async function initializeTransaction(
  params: InitializeParams,
): Promise<InitializeResult> {
  if (isSandbox()) {
    // Local stand-in for Paystack's hosted checkout.
    const base = process.env.APP_URL || "http://localhost:3000";
    return {
      authorizationUrl: `${base}/sandbox/pay/${params.reference}`,
      accessCode: null,
      reference: params.reference,
    };
  }

  const res = await fetch(`${API}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      amount: params.amountKobo, // Paystack works in kobo, same as we do.
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: params.metadata ?? {},
      currency: "NGN",
    }),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.status) {
    throw new PaystackError(
      `Could not start payment: ${body?.message ?? `HTTP ${res.status}`}`,
    );
  }

  return {
    authorizationUrl: body.data.authorization_url,
    accessCode: body.data.access_code ?? null,
    reference: body.data.reference,
  };
}

export interface VerifyResult {
  status: "success" | "failed" | "pending";
  amountKobo: number;
  reference: string;
  paidAt: Date | null;
  raw: unknown;
}

export async function verifyTransaction(reference: string): Promise<VerifyResult> {
  if (isSandbox()) {
    throw new PaystackError("verifyTransaction is not available in sandbox mode");
  }

  const res = await fetch(`${API}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey()}` },
  });

  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.status) {
    throw new PaystackError(
      `Could not verify payment: ${body?.message ?? `HTTP ${res.status}`}`,
    );
  }

  const data = body.data;
  const status =
    data.status === "success" ? "success" : data.status === "failed" ? "failed" : "pending";

  return {
    status,
    amountKobo: data.amount,
    reference: data.reference,
    paidAt: data.paid_at ? new Date(data.paid_at) : null,
    raw: data,
  };
}

/**
 * Verifies the `x-paystack-signature` header: HMAC-SHA512 of the raw request
 * body keyed with the secret. Must run against the raw body, never a
 * re-serialised object.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  if (!process.env.PAYSTACK_SECRET_KEY) return false;

  const expected = createHmac("sha512", secretKey()).update(rawBody).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
