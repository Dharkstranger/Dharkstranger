"use client";

import { useActionState, useState } from "react";

import { addPayoutAccountAction, type ActionState } from "@/app/actions";
import { btnClass } from "./ui";

export function BankAccountForm({
  banks,
}: {
  banks: { name: string; code: string }[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    addPayoutAccountAction,
    {},
  );
  const [bankCode, setBankCode] = useState(banks[0]?.code ?? "");

  const selected = banks.find((b) => b.code === bankCode);

  if (banks.length === 0) {
    return (
      <div className="rounded-2xl bg-[#FFF1D2] px-3.5 py-2.5 text-[12px] text-[#8a5f00]">
        The bank list is unavailable right now. Try again in a moment.
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="rounded-2xl border-[1.5px] border-dashed border-line bg-white p-4"
    >
      <div className="mb-3 font-display text-[14px] font-bold">Add a bank account</div>

      <label className="mb-3 block">
        <span className="label block">Bank</span>
        <select
          name="bankCode"
          value={bankCode}
          onChange={(e) => setBankCode(e.target.value)}
          className="field"
        >
          {banks.map((bank) => (
            <option key={bank.code} value={bank.code}>
              {bank.name}
            </option>
          ))}
        </select>
      </label>
      <input type="hidden" name="bankName" value={selected?.name ?? ""} />

      <label className="mb-3 block">
        <span className="label block">Account number</span>
        <input
          required
          name="accountNumber"
          inputMode="numeric"
          maxLength={10}
          placeholder="0123456789"
          className="field font-mono tracking-[0.1em]"
        />
      </label>

      {state.error && (
        <p role="alert" className="mb-2 text-[12px] font-medium text-[#B23A0A]">
          {state.error}
        </p>
      )}
      {state.ok && state.message && (
        <p className="mb-2 text-[12px] font-medium text-leaf">{state.message}</p>
      )}

      <button type="submit" disabled={pending} className={btnClass("primary")}>
        {pending ? "Checking with the bank…" : "Verify & save"}
      </button>

      <p className="mt-2 text-[11px] text-mute">
        We confirm the account name with your bank before anything can be paid out.
      </p>
    </form>
  );
}
