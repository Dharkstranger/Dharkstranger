import { db } from "./db";

/**
 * Image storage.
 *
 * Everything outside this file refers to images by URL, so swapping Postgres
 * for S3 or Vercel Blob later means changing `store()` and `urlFor()` and
 * nothing else.
 */

export class MediaError extends Error {}

/** Post-downscale ceiling. The browser resizes before uploading. */
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Sniffs the real format from the file's leading bytes.
 *
 * A `Content-Type` header is caller-supplied and therefore a claim, not a fact
 * — accepting it would let someone store an HTML or SVG payload that later
 * gets served back and executed. Only these three formats are ever stored.
 */
function sniffContentType(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  // RIFF....WEBP
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  if (riff === "RIFF" && webp === "WEBP") return "image/webp";

  return null;
}

export interface StoreImageInput {
  bytes: Uint8Array;
  ownerId?: string | null;
  width?: number | null;
  height?: number | null;
}

export async function storeImage(input: StoreImageInput): Promise<{ id: string; url: string }> {
  const { bytes, ownerId, width, height } = input;

  if (bytes.byteLength === 0) throw new MediaError("That file is empty");
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new MediaError(
      `Images must be under ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB`,
    );
  }

  const contentType = sniffContentType(bytes);
  if (!contentType || !ALLOWED.has(contentType)) {
    throw new MediaError("Upload a JPEG, PNG or WebP image");
  }

  const asset = await db.mediaAsset.create({
    data: {
      contentType,
      bytes: Buffer.from(bytes),
      byteSize: bytes.byteLength,
      width: width ?? null,
      height: height ?? null,
      ownerId: ownerId ?? null,
    },
    select: { id: true },
  });

  return { id: asset.id, url: urlFor(asset.id) };
}

export function urlFor(id: string): string {
  return `/api/media/${id}`;
}

/** Resolves a stored URL back to an id, for cleanup and OG rendering. */
export function idFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/\/api\/media\/([A-Za-z0-9_-]+)/);
  return match ? match[1]! : null;
}

export async function getImage(id: string) {
  return db.mediaAsset.findUnique({
    where: { id },
    select: { bytes: true, contentType: true, byteSize: true },
  });
}
