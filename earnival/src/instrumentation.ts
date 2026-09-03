/**
 * Boot-time configuration check.
 *
 * Next.js runs `register()` once when the server starts. Everything verified
 * here is something that, if missing, would either lose money or leak data —
 * so the process refuses to start rather than running in a quietly broken
 * state and being discovered on event day.
 *
 * Deliberately dependency-free: this module is compiled for the edge runtime
 * as well as node, so importing anything that reaches for `node:crypto` (which
 * most of `src/lib` does) breaks the build.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const problems: string[] = [];

  const appUrl = process.env.APP_URL ?? "";
  const servingLocally = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(appUrl);
  const deployed = process.env.NODE_ENV === "production" || (Boolean(appUrl) && !servingLocally);

  // Secrets that must never fall back to a default.
  for (const key of ["AUTH_SECRET", "QR_SECRET", "KYC_SECRET"] as const) {
    const value = process.env[key];
    if (!value) {
      problems.push(`${key} is not set`);
    } else if (value.length < 32) {
      problems.push(`${key} is too short — use \`openssl rand -hex 32\``);
    }
  }

  if (!process.env.DATABASE_URL) problems.push("DATABASE_URL is not set");

  // Mirrors isSandbox() in lib/paystack.ts. Kept in sync deliberately rather
  // than imported, for the runtime reason above.
  const hasPaymentKey = Boolean(process.env.PAYSTACK_SECRET_KEY);
  const sandboxAllowed = servingLocally || process.env.EARNIVAL_ALLOW_SANDBOX === "1";

  if (!hasPaymentKey && !sandboxAllowed) {
    problems.push(
      "PAYSTACK_SECRET_KEY is not set and this deployment is not local — " +
        "sandbox checkout would hand out free tickets. Set the key, or set " +
        "EARNIVAL_ALLOW_SANDBOX=1 if this really is a throwaway environment.",
    );
  }

  if (deployed) {
    if (!process.env.APP_URL) {
      problems.push("APP_URL must be set so ticket QR codes and emails resolve");
    }
    if (!process.env.RESEND_API_KEY) {
      problems.push(
        "RESEND_API_KEY is not set — tickets and sign-in codes could not be delivered",
      );
    }
    if (!process.env.CRON_SECRET) {
      problems.push("CRON_SECRET is not set — the settlement endpoint would be open");
    }
  }

  if (!hasPaymentKey && sandboxAllowed) {
    console.warn(
      "[earnival] SANDBOX MODE — payments are simulated. Never expose this publicly.",
    );
  }

  if (problems.length > 0) {
    const report = problems.map((p) => `  · ${p}`).join("\n");
    if (deployed) {
      throw new Error(`Earnival cannot start — configuration problems:\n${report}`);
    }
    console.warn(`[earnival] configuration warnings (non-fatal in dev):\n${report}`);
  }
}
