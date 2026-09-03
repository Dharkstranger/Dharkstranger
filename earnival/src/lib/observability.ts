import { formatNaira } from "./money";

/**
 * Error capture and money alerting.
 *
 * The failure that actually hurts is silent: a settlement that never went out,
 * a refund stuck at the processor, a webhook that threw. Nobody is watching a
 * log at 11pm at Landmark Beach, so anything touching money pushes a message
 * to somewhere a human will see it.
 *
 * Zero dependencies — Sentry is used over its HTTP ingest API when a DSN is
 * present, and alerts go to any Slack/Discord-compatible incoming webhook.
 */

export type Severity = "info" | "warning" | "error" | "critical";

interface CaptureContext {
  /** Short, stable label so repeats are groupable, e.g. "settlement.payout". */
  scope: string;
  severity?: Severity;
  /** Never put PII or secrets in here — it leaves the system. */
  detail?: Record<string, string | number | boolean | null | undefined>;
}

function redact(value: unknown): string {
  const text = value instanceof Error ? (value.stack ?? value.message) : String(value);
  return (
    text
      // Anything that looks like a key or token never leaves the process.
      .replace(/\b(sk|pk)_[a-zA-Z0-9_]+/g, "[redacted-key]")
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
      .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
      .slice(0, 4000)
  );
}

async function sendToSentry(message: string, context: CaptureContext): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  // DSN format: https://<key>@<host>/<projectId>
  const match = dsn.match(/^https:\/\/([^@]+)@([^/]+)\/(.+)$/);
  if (!match) return;
  const [, key, host, projectId] = match;

  try {
    await fetch(`https://${host}/api/${projectId}/store/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${key}, sentry_client=earnival/1.0`,
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        level: context.severity === "critical" ? "fatal" : (context.severity ?? "error"),
        logger: context.scope,
        environment: process.env.NODE_ENV ?? "development",
        message: { formatted: message },
        extra: context.detail ?? {},
      }),
    });
  } catch {
    // Reporting must never throw into the caller's path.
  }
}

async function sendToWebhook(text: string, severity: Severity): Promise<void> {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;

  const icon =
    severity === "critical" ? "🚨" : severity === "error" ? "❌" : severity === "warning" ? "⚠️" : "ℹ️";

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Slack and Discord both accept a bare `content`/`text` field.
      body: JSON.stringify({ text: `${icon} ${text}`, content: `${icon} ${text}` }),
    });
  } catch {
    // Same rule: alerting failures are not the caller's problem.
  }
}

/** Records an error. Safe to call anywhere; never throws. */
export async function captureError(
  error: unknown,
  context: CaptureContext,
): Promise<void> {
  const severity = context.severity ?? "error";
  const message = redact(error);

  console.error(
    JSON.stringify({
      level: severity,
      scope: context.scope,
      message,
      ...context.detail,
      at: new Date().toISOString(),
    }),
  );

  await Promise.all([
    sendToSentry(message, { ...context, severity }),
    // Only page a human for things that cost money or block a gate.
    severity === "critical" || severity === "error"
      ? sendToWebhook(`*${context.scope}* — ${message.split("\n")[0]}`, severity)
      : Promise.resolve(),
  ]);
}

/** A money event a human should look at, even though nothing threw. */
export async function alertOps(
  title: string,
  detail: string,
  severity: Severity = "warning",
): Promise<void> {
  console.warn(
    JSON.stringify({ level: severity, scope: "ops", title, detail, at: new Date().toISOString() }),
  );
  await sendToWebhook(`*${title}* — ${detail}`, severity);
}

export async function alertSettlementFailed(params: {
  reference: string;
  partyLabel: string;
  amountKobo: number;
  reason: string;
}): Promise<void> {
  await alertOps(
    "Settlement failed",
    `${params.partyLabel} · ${formatNaira(params.amountKobo)} · ${params.reference} · ${params.reason}. Earnings returned to the payable pool and will retry.`,
    "error",
  );
}

export async function alertRefundFailed(params: {
  reference: string;
  amountKobo: number;
  reason: string;
}): Promise<void> {
  await alertOps(
    "Refund failed at the processor",
    `${params.reference} · ${formatNaira(params.amountKobo)} · ${params.reason}. The ledger already shows it reversed — the cash did not move.`,
    "critical",
  );
}

export async function alertWebhookUnprocessed(params: {
  provider: string;
  eventType: string;
  externalId: string;
  reason: string;
}): Promise<void> {
  await alertOps(
    "Webhook could not be processed",
    `${params.provider}/${params.eventType} · ${params.externalId} · ${params.reason}. Stored for replay from the admin console.`,
    "error",
  );
}
