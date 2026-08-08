import { NextResponse } from "next/server";
import { z } from "zod";

import {
  AuthError,
  destroySession,
  requestSignInCode,
  verifySignInCode,
} from "@/lib/auth";

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

  try {
    switch (parsed.data.action) {
      case "request":
        await requestSignInCode(parsed.data.email);
        // Always the same response, so this cannot enumerate accounts.
        return NextResponse.json({ sent: true });

      case "verify": {
        const user = await verifySignInCode(parsed.data.email, parsed.data.code);
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
