/**
 * Transactional email.
 *
 * Falls back to a console transport when no provider key is configured, so the
 * whole app runs locally without external dependencies. Sign-in codes are
 * printed to the server log in that mode.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /**
   * Marks a message whose body is a credential — a sign-in code, a ticket QR
   * link, a pickup code. These are never written to logs outside local
   * development, because anyone with log access could otherwise use them.
   */
  sensitive?: boolean;
}

const FROM = process.env.EMAIL_FROM || "Earnival <tickets@earnival.app>";

export class MailError extends Error {}

/** True when this process is serving something other than a local dev machine. */
function isDeployed(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  const appUrl = process.env.APP_URL ?? "";
  return Boolean(appUrl) && !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(appUrl);
}

async function sendViaResend(message: EmailMessage): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend rejected the message: ${res.status} ${await res.text()}`);
  }
}

function sendViaConsole(message: EmailMessage): void {
  console.log(
    [
      "",
      "──────────────── EMAIL (console transport) ────────────────",
      `To:      ${message.to}`,
      `Subject: ${message.subject}`,
      "",
      message.text,
      "───────────────────────────────────────────────────────────",
      "",
    ].join("\n"),
  );
}

/**
 * Sends a message.
 *
 * The console transport is a local-development convenience, not a fallback for
 * a real deployment: printing sign-in codes and ticket links into a log would
 * let anyone with log access sign in as any user. So on a deployed instance a
 * credential email that cannot be delivered throws, and an ordinary one records
 * only that delivery failed — never its contents.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  if (process.env.RESEND_API_KEY) {
    try {
      await sendViaResend(message);
      return;
    } catch (error) {
      if (message.sensitive) {
        // The user is standing there waiting for a code. Surface it.
        throw new MailError("We couldn't send that email. Try again in a moment.");
      }
      // A receipt failing must never undo a completed purchase.
      console.error(
        `[mail] delivery failed for "${message.subject}" (recipient withheld):`,
        error instanceof Error ? error.message : error,
      );
      return;
    }
  }

  if (isDeployed()) {
    if (message.sensitive) {
      throw new MailError(
        "Email delivery is not configured, so this code cannot be sent. " +
          "Set RESEND_API_KEY.",
      );
    }
    console.error(
      `[mail] no provider configured; dropped "${message.subject}" (recipient withheld)`,
    );
    return;
  }

  sendViaConsole(message);
}

// ------------------------------------------------------------------
// Templates
// ------------------------------------------------------------------

const shell = (body: string) => `
<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#FAF6EF;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #E9E2D6;border-radius:20px;overflow:hidden">
    <div style="background:#1C1030;padding:20px 24px">
      <span style="color:#fff;font-size:20px;font-weight:800">earn<span style="color:#FF5E1A">i</span>val</span>
    </div>
    <div style="padding:24px;color:#1C1030;font-size:15px;line-height:1.6">${body}</div>
  </div>
</div>`;

export function signInCodeEmail(code: string): Omit<EmailMessage, "to"> {
  return {
    sensitive: true,
    subject: `${code} is your Earnival sign-in code`,
    text: `Your Earnival sign-in code is ${code}. It expires in 10 minutes.`,
    html: shell(`
      <p>Here is your sign-in code:</p>
      <p style="font-family:monospace;font-size:32px;font-weight:700;letter-spacing:6px;margin:16px 0">${code}</p>
      <p style="color:#6E6578;font-size:13px">It expires in 10 minutes. If you didn't ask for it, ignore this email.</p>`),
  };
}

export function ticketEmail(params: {
  attendeeName: string;
  eventName: string;
  venue: string;
  startsAt: Date;
  ticketTypeName: string;
  code: string;
  ticketUrl: string;
  organiserNote?: string | null;
}): Omit<EmailMessage, "to"> {
  const when = params.startsAt.toLocaleString("en-NG", {
    dateStyle: "full",
    timeStyle: "short",
  });
  return {
    // Carries the QR link and check-in code — the ticket itself.
    sensitive: true,
    subject: `Your ticket to ${params.eventName}`,
    text: [
      `You're in, ${params.attendeeName}.`,
      ``,
      `${params.eventName}`,
      `${when}`,
      `${params.venue}`,
      ``,
      `Ticket: ${params.ticketTypeName}`,
      `Check-in code: ${params.code}`,
      `Your badge and QR code: ${params.ticketUrl}`,
      params.organiserNote ? `\nFrom the organiser: ${params.organiserNote}` : "",
    ].join("\n"),
    html: shell(`
      <p style="font-size:18px;font-weight:700;margin:0 0 4px">You're in, ${params.attendeeName}.</p>
      <p style="margin:0 0 16px;color:#6E6578">Show the QR code at the gate.</p>
      <div style="background:#FAF6EF;border:1px solid #E9E2D6;border-radius:14px;padding:16px;margin-bottom:16px">
        <div style="font-weight:700;font-size:16px">${params.eventName}</div>
        <div style="color:#6E6578;font-size:14px;margin-top:4px">${when}</div>
        <div style="color:#6E6578;font-size:14px">${params.venue}</div>
        <div style="margin-top:12px;font-size:14px">${params.ticketTypeName}</div>
        <div style="margin-top:4px;font-size:14px">Check-in code:
          <b style="font-family:monospace;letter-spacing:2px">${params.code}</b>
        </div>
      </div>
      <a href="${params.ticketUrl}" style="display:inline-block;background:#FF5E1A;color:#fff;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:600">View your badge &amp; QR</a>
      ${
        params.organiserNote
          ? `<p style="margin-top:20px;padding-top:16px;border-top:1px solid #E9E2D6;color:#6E6578;font-size:14px"><b>From the organiser:</b> ${params.organiserNote}</p>`
          : ""
      }`),
  };
}

export function orderReceiptEmail(params: {
  buyerName: string;
  shopName: string;
  reference: string;
  items: { name: string; quantity: number }[];
  totalLabel: string;
  paid: boolean;
  orderUrl: string;
}): Omit<EmailMessage, "to"> {
  const itemLines = params.items.map((i) => `${i.name} ×${i.quantity}`).join("\n");
  return {
    subject: `Order ${params.reference} — ${params.shopName}`,
    text: [
      `Thanks, ${params.buyerName}.`,
      ``,
      `Order ${params.reference} from ${params.shopName}`,
      itemLines,
      `Total: ${params.totalLabel}`,
      params.paid ? `Status: paid` : `Status: pay at the event`,
      ``,
      `Track it: ${params.orderUrl}`,
    ].join("\n"),
    html: shell(`
      <p style="font-size:18px;font-weight:700;margin:0 0 12px">Thanks, ${params.buyerName}.</p>
      <div style="background:#FAF6EF;border:1px solid #E9E2D6;border-radius:14px;padding:16px;margin-bottom:16px">
        <div style="font-family:monospace;font-weight:700">${params.reference}</div>
        <div style="color:#6E6578;font-size:14px;margin-bottom:8px">${params.shopName}</div>
        ${params.items
          .map(
            (i) =>
              `<div style="font-size:14px">${i.name} <span style="color:#6E6578">×${i.quantity}</span></div>`,
          )
          .join("")}
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid #E9E2D6;font-weight:700">${params.totalLabel}</div>
        <div style="color:#6E6578;font-size:13px;margin-top:4px">${
          params.paid ? "Paid" : "Pay at the event"
        }</div>
      </div>
      <a href="${params.orderUrl}" style="display:inline-block;background:#1C1030;color:#fff;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:600">Track your order</a>`),
  };
}

export function pickupReadyEmail(params: {
  buyerName: string;
  shopName: string;
  reference: string;
  pickupCode: string;
}): Omit<EmailMessage, "to"> {
  return {
    // Carries the pickup code that releases the goods.
    sensitive: true,
    subject: `Ready for pickup — ${params.reference}`,
    text: `${params.buyerName}, your order from ${params.shopName} is ready. Pickup code: ${params.pickupCode}`,
    html: shell(`
      <p style="font-size:18px;font-weight:700;margin:0 0 4px">Your order is ready.</p>
      <p style="color:#6E6578;margin:0 0 16px">${params.shopName} — ${params.reference}</p>
      <p>Show this code at the stand:</p>
      <p style="font-family:monospace;font-size:30px;font-weight:700;letter-spacing:5px;margin:12px 0">${params.pickupCode}</p>`),
  };
}
