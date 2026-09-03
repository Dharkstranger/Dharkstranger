"use client";

import { useActionState, useState } from "react";

import { revokeEventMemberAction, type ActionState } from "@/app/actions";

export function RevokeMemberButton({ memberId }: { memberId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    revokeEventMemberAction,
    {},
  );
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-[12px] font-semibold text-[#B23A0A]"
      >
        Remove from team
      </button>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="memberId" value={memberId} />
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-[12px] font-semibold text-mute"
      >
        Keep
      </button>
      <button
        type="submit"
        disabled={pending}
        className="text-[12px] font-semibold text-[#B23A0A] underline"
      >
        {pending ? "Removing…" : "Yes, remove"}
      </button>
      {state.error && (
        <span role="alert" className="text-[12px] text-[#B23A0A]">
          {state.error}
        </span>
      )}
    </form>
  );
}
