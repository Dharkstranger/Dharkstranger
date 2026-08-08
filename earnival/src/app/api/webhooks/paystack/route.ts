import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { failPayment, settlePayment } from "@/lib/commerce";
import { verifyWebhookSignature } from "@/lib/paystack";

/**
 * Paystack webhook — the authoritative source of payment truth.
 *
 * Three rules this endpoint enforces:
 *  1. The HMAC-SHA512 signature is verified against the RAW body before
 *     anything is parsed or trusted.
 *  2. Every delivery is recorded under a unique (provider, externalId) key, so
 *     Paystack's retries cannot settle the same payment twice.
 *  3. It always answers 200 once a delivery is durably recorded — a 500 makes
 *     Paystack retry, and retrying a poison payload forever helps nobody.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!verifyWebhookSignature(raw, signature)) {
    // Do not leak whether the key is missing or the signature merely wrong.
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: { event?: string; data?: { id?: number; reference?: string } };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  const eventType = payload.event ?? "unknown";
  const reference = payload.data?.reference;
  const externalId = String(payload.data?.id ?? reference ?? "");

  if (!reference || !externalId) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  // Claim the delivery. A duplicate hits the unique constraint and exits early.
  try {
    await db.webhookEvent.create({
      data: { provider: "paystack", externalId, eventType, payload: payload as object },
    });
  } catch {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    if (eventType === "charge.success") {
      await settlePayment(reference, payload.data);
    } else if (eventType === "charge.failed") {
      await failPayment(reference);
    }

    await db.webhookEvent.updateMany({
      where: { provider: "paystack", externalId },
      data: { processedAt: new Date() },
    });
  } catch (error) {
    console.error("[webhook/paystack] processing failed:", error);
    await db.webhookEvent.updateMany({
      where: { provider: "paystack", externalId },
      data: { error: error instanceof Error ? error.message : String(error) },
    });
    // Still 200: the delivery is stored and can be replayed from the admin side.
  }

  return NextResponse.json({ received: true });
}
