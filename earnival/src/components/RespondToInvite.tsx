"use client";

import { useActionState } from "react";

import {
  respondToEventInviteAction,
  respondToShopInviteAction,
  type ActionState,
} from "@/app/actions";
import { btnClass } from "./ui";

export function RespondToInvite({
  memberId,
  kind,
}: {
  memberId: string;
  kind: "event" | "shop";
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    kind === "event" ? respondToEventInviteAction : respondToShopInviteAction,
    {},
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="memberId" value={memberId} />
      {state.error && (
        <p role="alert" className="mb-2 text-[13px] font-medium text-[#B23A0A]">
          {state.error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          name="decision"
          value="reject"
          disabled={pending}
          className={btnClass("quiet")}
        >
          Decline
        </button>
        <button
          type="submit"
          name="decision"
          value="accept"
          disabled={pending}
          className={btnClass("flame")}
        >
          {pending ? "Saving…" : "Accept"}
        </button>
      </div>
    </form>
  );
}
