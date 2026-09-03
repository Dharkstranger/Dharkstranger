import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { isLive, isSandbox } from "@/lib/paystack";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Liveness and configuration check.
 *
 * Answers the question you actually ask at 11pm at a venue: is the thing up,
 * can it reach its database, and is it configured to take money? Deliberately
 * leaks no secrets — only whether each is present.
 */
export async function GET() {
  const startedAt = Date.now();

  let database: "ok" | "unreachable" = "unreachable";
  let latencyMs: number | null = null;
  try {
    const began = Date.now();
    await db.$queryRaw`SELECT 1`;
    latencyMs = Date.now() - began;
    database = "ok";
  } catch (error) {
    console.error("[health] database unreachable:", error);
  }

  const config = {
    payments: isLive() ? "live" : isSandbox() ? "sandbox" : "unconfigured",
    email: Boolean(process.env.RESEND_API_KEY),
    sms: Boolean(process.env.TERMII_API_KEY),
    whatsapp: Boolean(process.env.WHATSAPP_TOKEN),
    cronSecret: Boolean(process.env.CRON_SECRET),
    kycSecret: Boolean(process.env.KYC_SECRET),
    pooledDatabase: (process.env.DATABASE_URL ?? "").includes("pgbouncer=true"),
  };

  const healthy = database === "ok";

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      database,
      latencyMs,
      config,
      uptimeSeconds: Math.round(process.uptime()),
      checkedInMs: Date.now() - startedAt,
    },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
