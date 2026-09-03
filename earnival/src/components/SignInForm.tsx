"use client";

import { useState } from "react";
import { btnClass } from "./ui";

export function SignInForm({ next }: { next: string }) {
  const [stage, setStage] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function post(body: unknown) {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { ok: res.ok, data: await res.json() };
  }

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { ok, data } = await post({ action: "request", email });
    setBusy(false);
    if (!ok) {
      setError(data.error ?? "Could not send a code");
      return;
    }
    setStage("code");
    setNotice(`We sent a 6-digit code to ${email}.`);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { ok, data } = await post({ action: "verify", email, code });
    if (!ok) {
      setBusy(false);
      setError(data.error ?? "That code isn't right");
      return;
    }
    window.location.href = next;
  }

  if (stage === "email") {
    return (
      <form onSubmit={requestCode}>
        <label className="mb-4 block">
          <span className="label block">Email</span>
          <input
            required
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@mail.com"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "signin-email-error" : undefined}
            className="field"
          />
        </label>
        {error && (
          <p
            id="signin-email-error"
            role="alert"
            className="mb-3 text-[13px] font-medium text-[#B23A0A]"
          >
            {error}
          </p>
        )}
        <button type="submit" disabled={busy || !email} className={btnClass("primary")}>
          {busy ? "Sending…" : "Email me a sign-in code"}
        </button>
        <p className="mt-3 text-center text-[12px] text-mute">
          No passwords. We send a code each time.
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={verify}>
      {notice && <p className="mb-4 text-[13px] text-mute">{notice}</p>}
      <label className="mb-4 block">
        <span className="label block">6-digit code</span>
        <input
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="123456"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "signin-code-error" : undefined}
          className="field font-mono text-[20px] tracking-[0.3em]"
        />
      </label>
      {error && (
        <p
          id="signin-code-error"
          role="alert"
          className="mb-3 text-[13px] font-medium text-[#B23A0A]"
        >
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || code.length !== 6}
        className={btnClass("primary")}
      >
        {busy ? "Checking…" : "Verify & sign in"}
      </button>
      <button
        type="button"
        onClick={() => {
          setStage("email");
          setCode("");
          setError(null);
        }}
        className="mt-3 w-full text-[13px] font-semibold text-plum"
      >
        Use a different email
      </button>
    </form>
  );
}
