"use client";

import { useActionState } from "react";

import { reviewVerificationAction, type ActionState } from "@/app/actions";
import { Chip, btnClass } from "./ui";

export function ReviewVerification(props: {
  submissionId: string;
  kind: string;
  last4: string | null;
  businessName: string | null;
  targetLevel: string;
  userName: string;
  currentLevel: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    reviewVerificationAction,
    {},
  );

  return (
    <div className="rounded-3xl border-[1.5px] border-line bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-display text-[14px] font-bold">
            {props.userName}
          </div>
          <div className="text-[12px] text-mute">
            {props.currentLevel} → {props.targetLevel}
          </div>
        </div>
        <Chip tone="gold">{props.kind}</Chip>
      </div>

      <div className="mt-3 rounded-2xl bg-paper p-3 text-[12px]">
        {props.businessName && (
          <div className="flex justify-between gap-3">
            <span className="text-mute">Business</span>
            <b>{props.businessName}</b>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <span className="text-mute">Identifier</span>
          <b className="font-mono">••••{props.last4 ?? "????"}</b>
        </div>
        <p className="mt-2 text-[11px] text-mute">
          The full identifier is encrypted at rest. Check it against the provider
          portal rather than requesting it here.
        </p>
      </div>

      {state.error && (
        <p role="alert" className="mt-2 text-[12px] font-medium text-[#B23A0A]">
          {state.error}
        </p>
      )}

      <form action={formAction} className="mt-3">
        <input type="hidden" name="submissionId" value={props.submissionId} />
        <input
          name="reason"
          placeholder="Reason (if rejecting)"
          className="field mb-2 text-[13px]"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            name="decision"
            value="reject"
            disabled={pending}
            className={btnClass("quiet")}
          >
            Reject
          </button>
          <button
            type="submit"
            name="decision"
            value="approve"
            disabled={pending}
            className={btnClass("flame")}
          >
            {pending ? "Saving…" : "Approve"}
          </button>
        </div>
      </form>
    </div>
  );
}
