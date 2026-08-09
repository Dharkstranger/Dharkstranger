"use client";

import { useState } from "react";
import { btnClass } from "./ui";

export function FindTicketsForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/find", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      setSent(data.message);
    } catch {
      setError("Network problem — check your connection and try again");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div
        role="status"
        className="rounded-3xl border-[1.5px] border-leaf bg-[#E3F0E7] p-5 text-center"
      >
        <div className="text-3xl" aria-hidden>
          📬
        </div>
        <p className="mt-2 font-display text-[16px] font-extrabold">Check your email</p>
        <p className="mt-1 text-[13px] text-[#3d5748]">{sent}</p>
        <p className="mt-3 text-[12px] text-[#3d5748]">
          The link works for 30 minutes. Look in spam if it hasn&apos;t arrived in a
          couple of minutes.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <label className="mb-4 block">
        <span className="label block">Email used at checkout</span>
        <input
          required
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@mail.com"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "find-error" : undefined}
          className="field"
        />
      </label>

      {error && (
        <p id="find-error" role="alert" className="mb-3 text-[13px] font-medium text-[#B23A0A]">
          {error}
        </p>
      )}

      <button type="submit" disabled={busy || !email} className={btnClass("flame")}>
        {busy ? "Sending…" : "Send me my tickets"}
      </button>
    </form>
  );
}
