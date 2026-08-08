"use client";

import { useState } from "react";
import { btnClass } from "./ui";

export function SandboxPayButtons({ reference }: { reference: string }) {
  const [busy, setBusy] = useState(false);

  async function complete(outcome: "success" | "fail") {
    setBusy(true);
    await fetch("/api/sandbox/pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference, outcome }),
    });
    window.location.href = `/pay/callback?reference=${reference}`;
  }

  return (
    <div className="mt-4 space-y-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => complete("success")}
        className={btnClass("flame")}
      >
        {busy ? "Processing…" : "Simulate successful payment"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => complete("fail")}
        className={btnClass("quiet")}
      >
        Simulate failed payment
      </button>
    </div>
  );
}
