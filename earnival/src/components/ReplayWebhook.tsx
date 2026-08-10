"use client";

import { useActionState } from "react";

import { replayWebhookAction, type ActionState } from "@/app/actions";
import { btnClass } from "./ui";

export function ReplayWebhook({ webhookEventId }: { webhookEventId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    replayWebhookAction,
    {},
  );

  return (
    <form action={formAction} className="mt-2">
      <input type="hidden" name="webhookEventId" value={webhookEventId} />
      {state.error && (
        <p role="alert" className="mb-1 text-[12px] font-medium text-[#B23A0A]">
          {state.error}
        </p>
      )}
      {state.ok && state.message && (
        <p role="status" className="mb-1 text-[12px] font-medium text-leaf">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className={btnClass("quiet", { small: true, full: false })}
      >
        {pending ? "Replaying…" : "Replay this delivery"}
      </button>
    </form>
  );
}
