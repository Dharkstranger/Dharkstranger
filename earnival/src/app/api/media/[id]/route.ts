import { getImage } from "@/lib/media";

export const runtime = "nodejs";

/**
 * Serves a stored image. Assets are immutable — the id is content's identity —
 * so they cache forever.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const asset = await getImage(id);

  if (!asset) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(asset.bytes), {
    headers: {
      "Content-Type": asset.contentType,
      "Content-Length": String(asset.byteSize),
      "Cache-Control": "public, max-age=31536000, immutable",
      // Belt and braces: never let a stored file be sniffed into something
      // executable, and never render it as a top-level document.
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
