"use client";

import { useActionState, useState } from "react";

import {
  requestPhoneCodeAction,
  verifyPhoneCodeAction,
  type ActionState,
} from "@/app/actions";
import { btnClass } from "./ui";

export function VerifyPhone() {
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);

  const [requestState, requestAction, requesting] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const result = await requestPhoneCodeAction(prev, formData);
      if (result.ok) setSent(true);
      return result;
    },
    {},
  );

  const [verifyState, verifyAction, verifying] = useActionState<ActionState, FormData>(
    verifyPhoneCodeAction,
    {},
  );

  return (
    <div className="rounded-2xl border-[1.5px] border-marigold bg-white p-4">
      <div className="font-display text-[14px] font-bold">Verify your phone</div>
      <p className="mb-3 mt-1 text-[12px] text-mute">
        Unlocks shops, instant publishing for paid events, and a ₦1m limit per event.
      </p>

      {!sent ? (
        <form action={requestAction}>
          <label className="mb-3 block">
            <span className="label block">Phone number</span>
            <input
              required
              name="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0801 234 5678"
              className="field"
            />
          </label>
          {requestState.error && (
            <p role="alert" className="mb-2 text-[12px] font-medium text-[#B23A0A]">
              {requestState.error}
            </p>
          )}
          <button type="submit" disabled={requesting} className={btnClass("primary")}>
            {requesting ? "Sending…" : "Send me a code"}
          </button>
        </form>
      ) : (
        <form action={verifyAction}>
          <input type="hidden" name="phone" value={phone} />
          <label className="mb-3 block">
            <span className="label block">6-digit code sent to {phone}</span>
            <input
              required
              name="code"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              className="field font-mono text-[18px] tracking-[0.3em]"
            />
          </label>
          {verifyState.error && (
            <p role="alert" className="mb-2 text-[12px] font-medium text-[#B23A0A]">
              {verifyState.error}
            </p>
          )}
          <button type="submit" disabled={verifying} className={btnClass("flame")}>
            {verifying ? "Checking…" : "Verify"}
          </button>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="mt-2 w-full text-[12px] font-semibold text-plum"
          >
            Use a different number
          </button>
        </form>
      )}
    </div>
  );
}
