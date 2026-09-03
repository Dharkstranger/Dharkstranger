import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { MAX_UPLOAD_BYTES, MediaError, storeImage } from "@/lib/media";
import { RATE_LIMITS, RateLimitError, limitRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** Uploads an image. Signed-in users only — anonymous uploads are a spam vector. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  try {
    await limitRequest(RATE_LIMITS.upload, request, user.id);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: error.message },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } },
      );
    }
  }

  // Reject oversized bodies before reading them into memory.
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_UPLOAD_BYTES * 1.1) {
    return NextResponse.json({ error: "That image is too large" }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Malformed upload" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image supplied" }, { status: 400 });
  }

  const width = Number(form.get("width") ?? 0) || null;
  const height = Number(form.get("height") ?? 0) || null;

  try {
    const stored = await storeImage({
      bytes: new Uint8Array(await file.arrayBuffer()),
      ownerId: user.id,
      width,
      height,
    });
    return NextResponse.json(stored);
  } catch (error) {
    if (error instanceof MediaError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[media] upload failed:", error);
    return NextResponse.json({ error: "Could not save that image" }, { status: 500 });
  }
}
