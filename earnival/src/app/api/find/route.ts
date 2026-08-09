import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { issueLookupToken, lookupUrl } from "@/lib/lookup";
import { sendEmail } from "@/lib/mail";
import { RATE_LIMITS, RateLimitError, limitRequest } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().trim().email("Enter the email you used at checkout"),
});

export async function POST(request: Request) {
  try {
    await limitRequest(RATE_LIMITS.lookup, request);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: error.message },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } },
      );
    }
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Enter a valid email" },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase();

  const [tickets, orders] = await Promise.all([
    db.ticket.count({
      where: { attendeeEmail: email, status: { in: ["VALID", "CHECKED_IN"] } },
    }),
    db.order.count({ where: { buyerEmail: email } }),
  ]);

  // Only send when there is something to find, but always answer identically —
  // otherwise this becomes a way to test whether an address bought a ticket.
  if (tickets > 0 || orders > 0) {
    const url = lookupUrl(issueLookupToken(email));
    await sendEmail({
      to: email,
      sensitive: true,
      subject: "Your Earnival tickets and orders",
      text: [
        "Here's the link to everything you've bought on Earnival:",
        "",
        url,
        "",
        "It works for the next 30 minutes. If you didn't ask for it, ignore this email.",
      ].join("\n"),
      html: `
        <div style="font-family:system-ui,sans-serif;background:#FAF6EF;padding:24px">
          <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #E9E2D6;border-radius:20px;overflow:hidden">
            <div style="background:#1C1030;padding:20px 24px">
              <span style="color:#fff;font-size:20px;font-weight:800">earn<span style="color:#FF5E1A">i</span>val</span>
            </div>
            <div style="padding:24px;color:#1C1030;font-size:15px;line-height:1.6">
              <p style="margin:0 0 16px">Here's everything you've bought:</p>
              <a href="${url}" style="display:inline-block;background:#FF5E1A;color:#fff;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:600">View my tickets &amp; orders</a>
              <p style="color:#6E6578;font-size:13px;margin-top:20px">This link works for 30 minutes. If you didn't ask for it, ignore this email.</p>
            </div>
          </div>
        </div>`,
    }).catch((error) => {
      console.error("[find] could not send lookup link:", error);
    });
  }

  return NextResponse.json({
    sent: true,
    message: "If that address has tickets or orders, we've sent a link to it.",
  });
}
