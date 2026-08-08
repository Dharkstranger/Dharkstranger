"use client";

import { useActionState } from "react";

import { submitBusinessAction, type ActionState } from "@/app/actions";
import { btnClass } from "./ui";

export function VerifyBusiness() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    submitBusinessAction,
    {},
  );

  return (
    <form action={formAction} className="rounded-2xl border-[1.5px] border-marigold bg-white p-4">
      <div className="font-display text-[14px] font-bold">Verify your business</div>
      <p className="mb-3 mt-1 text-[12px] text-mute">
        Removes your revenue limit entirely and adds a verified badge to your events
        and shops.
      </p>

      <label className="mb-3 block">
        <span className="label block">Registered business name</span>
        <input required name="businessName" placeholder="Gidi Events Ltd" className="field" />
      </label>

      <label className="mb-3 block">
        <span className="label block">CAC registration number</span>
        <input required name="cacNumber" placeholder="RC1234567" className="field font-mono" />
      </label>

      <label className="mb-3 block">
        <span className="label block">Tax identification number (TIN)</span>
        <input required name="tin" inputMode="numeric" placeholder="12345678" className="field font-mono" />
      </label>

      {state.error && (
        <p role="alert" className="mb-2 text-[12px] font-medium text-[#B23A0A]">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={btnClass("primary")}>
        {pending ? "Submitting…" : "Submit for review"}
      </button>
    </form>
  );
}
