"use client";

import { useActionState, useState } from "react";

import { submitIdentityAction, type ActionState } from "@/app/actions";
import { btnClass } from "./ui";

export function VerifyIdentity() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    submitIdentityAction,
    {},
  );
  const [kind, setKind] = useState<"BVN" | "NIN">("BVN");

  return (
    <form action={formAction} className="rounded-2xl border-[1.5px] border-marigold bg-white p-4">
      <div className="font-display text-[14px] font-bold">Verify your identity</div>
      <p className="mb-3 mt-1 text-[12px] text-mute">
        Raises your limit to ₦5m per event and switches you to daily settlement.
      </p>

      <div className="mb-3 flex gap-2">
        {(["BVN", "NIN"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setKind(option)}
            aria-pressed={kind === option}
            className={`rounded-full px-4 py-1.5 text-[12px] font-semibold ${
              kind === option
                ? "bg-night text-white"
                : "border-[1.5px] border-line bg-white text-night"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
      <input type="hidden" name="kind" value={kind} />

      <label className="mb-3 block">
        <span className="label block">{kind} (11 digits)</span>
        <input
          required
          name="value"
          inputMode="numeric"
          maxLength={11}
          placeholder="12345678901"
          className="field font-mono tracking-[0.15em]"
        />
      </label>

      {state.error && (
        <p role="alert" className="mb-2 text-[12px] font-medium text-[#B23A0A]">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={btnClass("primary")}>
        {pending ? "Submitting…" : "Submit for review"}
      </button>

      <p className="mt-2 text-[12px] text-mute">
        Encrypted before storage. Only the last four digits are ever displayed.
      </p>
    </form>
  );
}
