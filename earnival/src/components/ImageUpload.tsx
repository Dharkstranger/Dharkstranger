"use client";

import { useId, useRef, useState } from "react";

/**
 * Image picker that downscales in the browser before uploading.
 *
 * Phone cameras produce 4–12MB images. Sending those raw would be slow on a
 * Lagos mobile connection and wasteful to store, so the file is drawn to a
 * canvas at a sane ceiling and re-encoded as JPEG first. Typical result is
 * 150–400KB.
 */

interface Props {
  name: string;
  label: string;
  hint?: string;
  /** Existing image URL when editing. */
  defaultValue?: string | null;
  /** 16:9 for event banners, 1:1 for products. */
  aspect?: "wide" | "square";
  maxEdge?: number;
}

async function downscale(file: File, maxEdge: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not process image"))),
      "image/jpeg",
      0.85,
    );
  });
}

export function ImageUpload({
  name,
  label,
  hint,
  defaultValue = null,
  aspect = "wide",
  maxEdge = 1600,
}: Props) {
  const inputId = useId();
  const statusId = useId();
  const fileRef = useRef<HTMLInputElement>(null);

  const [url, setUrl] = useState<string | null>(defaultValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const blob = await downscale(file, maxEdge);
      const body = new FormData();
      body.append("file", blob, "upload.jpg");

      const res = await fetch("/api/media", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not upload that image");
        return;
      }
      setUrl(data.url);
    } catch {
      setError("Could not read that image. Try a different file.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4">
      <label htmlFor={inputId} className="label block">
        {label}
      </label>

      <input type="hidden" name={name} value={url ?? ""} />

      <div
        className={`relative w-full overflow-hidden rounded-2xl border-[1.5px] border-dashed border-line bg-white ${
          aspect === "wide" ? "aspect-[16/9]" : "aspect-square max-w-[180px]"
        }`}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-center">
            <span className="px-4 text-[13px] text-mute">
              {busy ? "Processing…" : "No image yet"}
            </span>
          </div>
        )}

        {busy && (
          <div className="absolute inset-0 grid place-items-center bg-white/70">
            <span className="text-[13px] font-semibold">Uploading…</span>
          </div>
        )}
      </div>

      <input
        id={inputId}
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-describedby={`${statusId}${hint ? ` ${statusId}-hint` : ""}`}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="rounded-xl bg-haze px-3 py-2 text-[13px] font-semibold disabled:opacity-50"
        >
          {url ? "Replace image" : "Choose image"}
        </button>
        {url && (
          <button
            type="button"
            onClick={() => {
              setUrl(null);
              if (fileRef.current) fileRef.current.value = "";
            }}
            className="rounded-xl px-3 py-2 text-[13px] font-semibold text-[#B23A0A]"
          >
            Remove
          </button>
        )}
      </div>

      {hint && (
        <p id={`${statusId}-hint`} className="mt-1 text-[12px] text-mute">
          {hint}
        </p>
      )}

      <p id={statusId} role="status" aria-live="polite" className="sr-only">
        {busy ? "Uploading image" : url ? "Image ready" : "No image selected"}
      </p>

      {error && (
        <p role="alert" className="mt-1 text-[13px] font-medium text-[#B23A0A]">
          {error}
        </p>
      )}
    </div>
  );
}
