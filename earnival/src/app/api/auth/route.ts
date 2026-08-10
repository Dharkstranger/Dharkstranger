import { NextResponse } from "next/server";
import { z } from "zod";

import {
  AuthError,
  destroySession,
  requestSignInCode,
  verifySignInCode,
} from "@/lib/auth";
import { RATE_LIMITS, RateLimitError, limitRequest } from "@/lib/rate-limit";
import { clientIp, recordConsent } from "@/lib/legal";

const requestSchema = z.object({
  action: z.literal("request"),
  email: z.string().trim().email("Enter a valid email"),
});

const verifySchema = z.object({
  action: z.literal("verify"),
  email: z.string().trim().email(),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

const signOutSchema = z.object({ action: z.literal("signout") });

const schema = z.discriminatedUnion("action", [
  requestSchema,
  verifySchema,
  signOutSchema,
]);

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

  // Requesting a code costs a real email; verifying is a guessing surface.
  if (parsed.data.action !== "signout") {
    try {
      await limitRequest(RATE_LIMITS.otp, request);
    } catch (error) {
      if (error instanceof RateLimitError) {
        return NextResponse.json(
          { error: error.message },
          { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } },
        );
      }
    }
  }

  try {
    switch (parsed.data.action) {
      case "request":
        await requestSignInCode(parsed.data.email);
        // Always the same response, so this cannot enumerate accounts.
        return NextResponse.json({ sent: true });

      case "verify": {
        const user = await verifySignInCode(parsed.data.email, parsed.data.code);
        // Signing in is the point at which someone becomes a seller, so this is
        // where agreement to the terms is captured and evidenced.
        await recordConsent({
          email: user.email,
          userId: user.id,
          kinds: ["TERMS", "PRIVACY"],
          ip: clientIp(request),
          userAgent: request.headers.get("user-agent"),
        }).catch(() => {});
        return NextResponse.json({ user: { id: user.id, email: user.email } });
      }

      case "signout":
        await destroySession();
        return NextResponse.json({ signedOut: true });
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[auth]", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
