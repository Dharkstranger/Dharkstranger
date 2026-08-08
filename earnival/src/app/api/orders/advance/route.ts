import { NextResponse } from "next/server";
import { z } from "zod";

import { CheckoutError, advanceOrder } from "@/lib/commerce";
import { getCurrentUser } from "@/lib/auth";

const schema = z.object({
  orderId: z.string().min(1),
  pickupCode: z.string().trim().max(20).optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Malformed request" }, { status: 400 });
  }

  try {
    const result = await advanceOrder(
      parsed.data.orderId,
      user.id,
      parsed.data.pickupCode,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CheckoutError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[orders/advance]", error);
    return NextResponse.json({ error: "Could not update that order" }, { status: 500 });
  }
}
