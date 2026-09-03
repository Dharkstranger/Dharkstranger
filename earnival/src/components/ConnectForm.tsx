"use client";

import { useActionState, useState } from "react";

import { requestConnectionAction, type ActionState } from "@/app/actions";
import { nairaToKobo, splitSale } from "@/lib/money";
import { btnClass } from "./ui";

export function ConnectForm({
  shopId,
  events,
}: {
  shopId: string;
  events: { id: string; name: string; slug: string }[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    requestConnectionAction,
    {},
  );
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [sharePct, setSharePct] = useState(5);

  // Show the vendor exactly what they keep before they send the request.
  const split = splitSale({
    grossKobo: nairaToKobo(10_000),
    serviceFeeBps: 750,
    revenueShareBps: Math.round(sharePct * 100),
  });

  return (
    <form
      action={formAction}
      className="rounded-2xl border-[1.5px] border-dashed border-plum bg-white p-3.5"
    >
      <div className="mb-2 font-display text-[14px] font-bold">Connect to an event</div>
      <input type="hidden" name="shopId" value={shopId} />

      <label className="mb-3 block">
        <span className="label block">Event</span>
        <select
          name="eventId"
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          className="field"
        >
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name}
            </option>
          ))}
        </select>
      </label>

      <label className="mb-2 block">
        <span className="label block">Share you offer the organiser: {sharePct}%</span>
        <input
          type="range"
          name="sharePct"
          min={0}
          max={20}
          step={1}
          value={sharePct}
          onChange={(e) => setSharePct(Number(e.target.value))}
          className="w-full accent-plum"
        />
      </label>

      <p className="mb-3 text-[12px] text-mute">
        On a ₦10,000 sale you keep{" "}
        <b className="font-mono text-night">
          ₦{(split.vendorNetKobo / 100).toLocaleString("en-NG")}
        </b>{" "}
        after the 7.5% service charge and this share.
      </p>

      {state.error && (
        <p role="alert" className="mb-2 text-[12px] font-medium text-[#B23A0A]">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="mb-2 text-[12px] font-medium text-leaf">
          Request sent — the organiser reviews your terms.
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !eventId}
        className={btnClass("primary", { small: true })}
      >
        {pending ? "Sending…" : "Send connection request"}
      </button>
    </form>
  );
}
