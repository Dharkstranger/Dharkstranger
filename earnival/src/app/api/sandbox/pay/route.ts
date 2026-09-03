import { NextResponse } from "next/server";
import { z } from "zod";

import { failPayment, settlePayment } from "@/lib/commerce";
import { isSandbox } from "@/lib/paystack";

/**
 * Local stand-in for completing a Paystack checkout, so the whole purchase loop
 * is exercisable without credentials. Hard-refuses to exist outside sandbox
 * mode — in production this route is a 404.
 */
export async function POST(request: Request) {
  if (!isSandbox()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = z
    .object({
      reference: z.string().min(1),
      outcome: z.enum(["success", "fail"]).default("success"),
    })
    .safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Malformed request" }, { status: 400 });
  }

  if (parsed.data.outcome === "fail") {
    await failPayment(parsed.data.reference);
    return NextResponse.json({ ok: true, status: "failed" });
  }

  await settlePayment(parsed.data.reference, { sandbox: true });
  return NextResponse.json({ ok: true, status: "success" });
}
