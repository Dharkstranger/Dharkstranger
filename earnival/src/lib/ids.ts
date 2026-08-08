import { randomBytes, randomInt } from "node:crypto";

/** Unambiguous alphabet: no O/0, no I/1, so codes survive being read aloud. */
const SAFE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomFrom(alphabet: string, length: number): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += alphabet[randomInt(0, alphabet.length)];
  }
  return out;
}

/** Check-in code printed on a ticket, e.g. "GG-8K4M". */
export function generateTicketCode(eventSlug: string): string {
  const prefix = eventSlug
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 2)
    .toUpperCase()
    .padEnd(2, "X");
  return `${prefix}-${randomFrom(SAFE_ALPHABET, 4)}`;
}

/** Code the buyer presents to collect a ready order. */
export function generatePickupCode(): string {
  return `PK-${randomFrom(SAFE_ALPHABET, 4)}`;
}

export function generateOrderGroupRef(sequence: number): string {
  return `EA-${sequence}`;
}

export function generatePaymentReference(): string {
  return `ern_${Date.now().toString(36)}_${randomBytes(6).toString("hex")}`;
}

export function generateSku(shopName: string, sequence: number): string {
  const prefix = shopName
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, "X");
  return `${prefix}-${String(sequence).padStart(4, "0")}`;
}

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "untitled"
  );
}

/**
 * Appends a short random suffix until the slug is free. Takes the existence
 * check as a callback so it works for events and shops alike.
 */
export async function uniqueSlug(
  base: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base);
  if (!(await exists(root))) return root;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = `${root}-${randomFrom("abcdefghijkmnpqrstuvwxyz23456789", 4)}`;
    if (!(await exists(candidate))) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
