import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import QRCode from "qrcode";

/**
 * Ticket QR codes.
 *
 * The prototype drew a random grid that *looked* like a QR code but encoded
 * nothing — no camera could read it. These are real, scannable QR codes whose
 * payload is an HMAC-signed URL, so:
 *
 *   - a generic phone camera opens the attendee's badge page, and
 *   - the organiser's scanner extracts a token it can verify server-side.
 *
 * The signature means a forged or edited token is rejected without a database
 * lookup, and ticket IDs cannot be guessed by incrementing.
 */

function secret(): string {
  const value = process.env.QR_SECRET;
  if (!value) {
    throw new Error("QR_SECRET is not set — refusing to issue unsigned tickets");
  }
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Builds the signed token stored on the ticket and embedded in its QR. */
export function issueTicketToken(ticketId: string): string {
  const nonce = randomBytes(6).toString("base64url");
  const payload = `${ticketId}.${nonce}`;
  return `${payload}.${sign(payload)}`;
}

/** Returns the ticket id if the token is authentic, otherwise null. */
export function verifyTicketToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [ticketId, nonce, signature] = parts;
  const expected = sign(`${ticketId}.${nonce}`);

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;

  return ticketId;
}

export function ticketUrl(token: string): string {
  const base = process.env.APP_URL || "http://localhost:3000";
  return `${base}/t/${token}`;
}

/**
 * Pulls a ticket token out of whatever the scanner produced — either a full
 * badge URL or a bare token pasted in by hand.
 */
export function extractTokenFromScan(scanned: string): string | null {
  const trimmed = scanned.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/t\/(.+)$/);
    if (match) return match[1];
  } catch {
    // Not a URL — fall through and treat it as a raw token.
  }

  return trimmed.split(".").length === 3 ? trimmed : null;
}

export async function qrDataUrl(text: string, size = 320): Promise<string> {
  return QRCode.toDataURL(text, {
    width: size,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#1C1030", light: "#FFFFFF" },
  });
}

export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#1C1030", light: "#FFFFFF" },
  });
}
