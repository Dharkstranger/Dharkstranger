import { NextResponse } from "next/server";
import { z } from "zod";

import { createTicketCheckout, settlePayment, SoldOutError, CheckoutError } from "@/lib/commerce";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { initializeTransaction } from "@/lib/paystack";

const schema = z.object({
  eventSlug: z.string().min(1),
  lines: z
    .array(
      z.object({
        ticketTypeId: z.string().min(1),
        quantity: z.number().int().min(1).max(20),
      }),
    )
    .min(1),
  buyer: z.object({
    name: z.string().trim().min(2, "Enter your full name").max(120),
    email: z.string().trim().email("Enter a valid email"),
    phone: z.string().trim().max(30).optional().nullable(),
  }),
});

export async function POST(request: Request) {
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
    // Note: no price comes from the client. createTicketCheckout reads prices
    // from the database and reserves inventory atomically.
    const checkout = await createTicketCheckout({
      ...parsed.data,
      userId: user?.id ?? null,
    });

    const base = process.env.APP_URL || "http://localhost:3000";

    if (checkout.free) {
      await settlePayment(checkout.reference, { free: true });
      return NextResponse.json({
        redirectUrl: `/pay/callback?reference=${checkout.reference}`,
      });
    }

    const init = await initializeTransaction({
      email: parsed.data.buyer.email,
      amountKobo: checkout.amountKobo,
      reference: checkout.reference,
      callbackUrl: `${base}/pay/callback?reference=${checkout.reference}`,
      metadata: { purpose: "TICKETS", eventSlug: parsed.data.eventSlug },
    });

    await db.payment.update({
      where: { id: checkout.paymentId },
      data: { authorizationUrl: init.authorizationUrl },
    });

    return NextResponse.json({ redirectUrl: init.authorizationUrl });
  } catch (error) {
    if (error instanceof SoldOutError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof CheckoutError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[checkout/tickets]", error);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }
}
