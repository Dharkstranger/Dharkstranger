import { NextResponse } from "next/server";
import { z } from "zod";

import {
  CheckoutError,
  RevenueCapError,
  SoldOutError,
  createProductCheckout,
  settlePayment,
} from "@/lib/commerce";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { initializeTransaction } from "@/lib/paystack";
import { RATE_LIMITS, RateLimitError, limitRequest } from "@/lib/rate-limit";

const schema = z.object({
  eventSlug: z.string().min(1).nullable(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(50),
      }),
    )
    .min(1),
  buyer: z.object({
    name: z.string().trim().min(2, "Enter your full name").max(120),
    email: z.string().trim().email("Enter a valid email"),
    phone: z.string().trim().max(30).optional().nullable(),
  }),
  payNow: z.boolean(),
});

export async function POST(request: Request) {
  try {
    await limitRequest(RATE_LIMITS.checkout, request);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: error.message },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } },
      );
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Check your details" },
      { status: 400 },
    );
  }

  const user = await getCurrentUser();

  try {
    const checkout = await createProductCheckout({
      ...parsed.data,
      userId: user?.id ?? null,
    });

    // Pay-at-event orders are real orders immediately; no charge is raised.
    if (!parsed.data.payNow) {
      return NextResponse.json({
        redirectUrl: `/orders/${checkout.orderReferences[0]}`,
      });
    }

    if (checkout.free) {
      await settlePayment(checkout.reference, { free: true });
      return NextResponse.json({
        redirectUrl: `/pay/callback?reference=${checkout.reference}`,
      });
    }

    const base = process.env.APP_URL || "http://localhost:3000";
    const init = await initializeTransaction({
      email: parsed.data.buyer.email,
      amountKobo: checkout.amountKobo,
      reference: checkout.reference,
      callbackUrl: `${base}/pay/callback?reference=${checkout.reference}`,
      metadata: { purpose: "ORDER", groupRef: checkout.groupRef },
    });

    await db.payment.update({
      where: { id: checkout.paymentId },
      data: { authorizationUrl: init.authorizationUrl },
    });

    return NextResponse.json({ redirectUrl: init.authorizationUrl });
  } catch (error) {
    if (error instanceof SoldOutError || error instanceof RevenueCapError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof CheckoutError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[checkout/order]", error);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }
}
