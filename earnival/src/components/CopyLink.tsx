"use client";

import { useState } from "react";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const display = url.replace(/^https?:\/\//, "");

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // Clipboard blocked — the link is visible on screen to copy by hand.
          }
        }}
        className="mx-auto flex items-center gap-2 rounded-2xl border-[1.5px] border-line bg-white px-4 py-3"
      >
        <span className="font-mono text-[13px] font-semibold">{display}</span>
        <span className="text-[12px] font-semibold text-plum">
          {copied ? "Copied ✓" : "Copy"}
        </span>
      </button>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(url)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-2xl bg-haze px-3 py-2.5 text-[13px] font-semibold"
        >
          Share to WhatsApp
        </a>
        <a
          href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-2xl bg-haze px-3 py-2.5 text-[13px] font-semibold"
        >
          Share to X
        </a>
      </div>
    </div>
  );
}
