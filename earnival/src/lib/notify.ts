import { formatNaira } from "./money";
import { normalisePhone } from "./verification";

/**
 * Vendor sale alerts (PRD NTF-02).
 *
 * A vendor working a stall is not watching a dashboard — they need a ping on
 * the phone in their apron. WhatsApp is the channel they already live in, with
 * SMS as the fallback, because a missed sale alert is a customer standing at a
 * counter that nobody is serving.
 *
 * Delivery is strictly best-effort: an alert must never be able to fail a sale
 * that has already been paid for.
 */

export type AlertChannel = "whatsapp" | "sms" | "none";

export interface AlertResult {
  channel: AlertChannel;
  delivered: boolean;
}

function deployed(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  const appUrl = process.env.APP_URL ?? "";
  return Boolean(appUrl) && !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(appUrl);
}

/**
 * WhatsApp Cloud API. Business-initiated messages must use an approved
 * template, so the template name and its variables are configurable rather
 * than hard-coded prose.
 */
async function sendWhatsApp(phone: string, body: string): Promise<boolean> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return false;

  const template = process.env.WHATSAPP_TEMPLATE_NAME;

  try {
    const payload = template
      ? {
          messaging_product: "whatsapp",
          to: phone.replace(/^\+/, ""),
          type: "template",
          template: {
            name: template,
            language: { code: process.env.WHATSAPP_TEMPLATE_LOCALE || "en" },
            components: [
              { type: "body", parameters: [{ type: "text", text: body }] },
            ],
          },
        }
      : {
          messaging_product: "whatsapp",
          to: phone.replace(/^\+/, ""),
          type: "text",
          text: { body },
        };

    const res = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    if (res.ok) return true;
    console.error("[notify] WhatsApp rejected the message:", res.status);
    return false;
  } catch {
    console.error("[notify] WhatsApp delivery failed");
    return false;
  }
}

async function sendSmsFallback(phone: string, body: string): Promise<boolean> {
  const apiKey = process.env.TERMII_API_KEY;
  if (!apiKey) return false;

  try {
    const res = await fetch("https://api.ng.termii.com/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: phone,
        from: process.env.TERMII_SENDER_ID || "Earnival",
        sms: body,
        type: "plain",
        channel: "generic",
        api_key: apiKey,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function deliver(rawPhone: string | null, body: string): Promise<AlertResult> {
  if (!rawPhone) return { channel: "none", delivered: false };
  const phone = normalisePhone(rawPhone);

  if (await sendWhatsApp(phone, body)) {
    return { channel: "whatsapp", delivered: true };
  }
  if (await sendSmsFallback(phone, body)) {
    return { channel: "sms", delivered: true };
  }

  // Sale alerts carry no credentials, so logging them locally is harmless and
  // makes the flow visible in development.
  if (!deployed()) {
    console.log(`\n──────── ALERT (console) ────────\nTo:  ${phone}\n${body}\n─────────────────────────────────\n`);
    return { channel: "none", delivered: false };
  }

  console.warn("[notify] no alert channel configured; sale alert dropped");
  return { channel: "none", delivered: false };
}

// ------------------------------------------------------------------
// Templates
// ------------------------------------------------------------------

export async function notifyVendorOfSale(params: {
  phone: string | null;
  shopName: string;
  reference: string;
  items: { name: string; quantity: number }[];
  totalKobo: number;
  paid: boolean;
  buyerName: string;
}): Promise<AlertResult> {
  const lines = params.items
    .map((i) => `${i.name} x${i.quantity}`)
    .join(", ");

  const body = [
    `New order at ${params.shopName}`,
    `${params.reference}`,
    lines,
    `${formatNaira(params.totalKobo)} — ${params.paid ? "PAID" : "pay at event"}`,
    `Buyer: ${params.buyerName}`,
  ].join("\n");

  return deliver(params.phone, body);
}

export async function notifyVendorLowStock(params: {
  phone: string | null;
  shopName: string;
  productName: string;
  remaining: number;
}): Promise<AlertResult> {
  const body = `${params.shopName}: ${params.productName} is down to ${params.remaining} left.`;
  return deliver(params.phone, body);
}

export async function notifyOrganiserOfRefund(params: {
  phone: string | null;
  eventName: string;
  reference: string;
  amountKobo: number;
}): Promise<AlertResult> {
  const body = [
    `Refund issued on ${params.eventName}`,
    `${params.reference} — ${formatNaira(params.amountKobo)}`,
    `Your share on that sale has been reversed.`,
  ].join("\n");
  return deliver(params.phone, body);
}
