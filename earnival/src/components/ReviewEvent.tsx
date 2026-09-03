"use client";

import { useActionState } from "react";

import { reviewEventAction, type ActionState } from "@/app/actions";
import { Chip, btnClass } from "./ui";

export function ReviewEvent(props: {
  eventId: string;
  name: string;
  slug: string;
  venue: string;
  startsAt: string;
  organiserName: string;
  organiserLevel: string;
  ticketSummary: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    reviewEventAction,
    {},
  );

  return (
    <div className="rounded-3xl border-[1.5px] border-marigold bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-display text-[15px] font-bold leading-tight">
            {props.name}
          </div>
          <div className="text-[12px] text-mute">
            {props.startsAt} · {props.venue}
          </div>
        </div>
        <Chip tone="gold">{props.organiserLevel}</Chip>
      </div>

      <dl className="mt-3 space-y-1 rounded-2xl bg-paper p-3 text-[12px]">
        <div className="flex justify-between gap-3">
          <dt className="text-mute">Organiser</dt>
          <dd className="text-right font-semibold">{props.organiserName}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-mute">Tickets</dt>
          <dd className="text-right">{props.ticketSummary}</dd>
        </div>
      </dl>

      <a
        href={`/e/${props.slug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 block text-[12px] font-semibold text-plum"
      >
        Open the event page ↗
      </a>

      {state.error && (
        <p role="alert" className="mt-2 text-[12px] font-medium text-[#B23A0A]">
          {state.error}
        </p>
      )}

      <form action={formAction} className="mt-3">
        <input type="hidden" name="eventId" value={props.eventId} />
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
