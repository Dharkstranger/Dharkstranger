"use client";

import { useActionState, useState } from "react";

import { updateEventAction, type ActionState } from "@/app/actions";
import { ImageUpload } from "./ImageUpload";
import { btnClass } from "./ui";

interface EventView {
  id: string;
  name: string;
  venue: string;
  description: string | null;
  organiserNote: string | null;
  bannerUrl: string | null;
  date: string;
  time: string;
}

export function EditEventForm({
  event,
  ticketHolders,
}: {
  event: EventView;
  ticketHolders: number;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateEventAction,
    {},
  );
  const [notify, setNotify] = useState(false);

  return (
    <form action={formAction}>
      <input type="hidden" name="eventId" value={event.id} />

      <label className="mb-4 block">
        <span className="label block">Event name</span>
        <input required name="name" defaultValue={event.name} className="field" />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="mb-4 block">
          <span className="label block">Date</span>
          <input required type="date" name="date" defaultValue={event.date} className="field" />
        </label>
        <label className="mb-4 block">
          <span className="label block">Start time</span>
          <input required type="time" name="time" defaultValue={event.time} className="field" />
        </label>
      </div>

      <label className="mb-4 block">
        <span className="label block">Venue</span>
        <input required name="venue" defaultValue={event.venue} className="field" />
      </label>

      <ImageUpload
        name="bannerUrl"
        label="Event banner"
        hint="Shown when your link is shared."
        defaultValue={event.bannerUrl}
        aspect="wide"
      />

      <label className="mb-4 block">
        <span className="label block">About it</span>
        <textarea
          name="description"
          rows={3}
          defaultValue={event.description ?? ""}
          className="field resize-none"
        />
      </label>

      <label className="mb-4 block">
        <span className="label block">Note shown after purchase</span>
        <input
          name="organiserNote"
          defaultValue={event.organiserNote ?? ""}
          className="field"
        />
      </label>

      {ticketHolders > 0 && (
        <div className="mb-4 rounded-2xl border-[1.5px] border-line bg-white p-4">
          <label className="flex items-center justify-between text-[14px] font-semibold">
            <span>
              Tell the {ticketHolders} {ticketHolders === 1 ? "person" : "people"} who
              already have tickets
            </span>
            <input
              type="checkbox"
              name="notifyAttendees"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
              className="ml-3 h-5 w-5 shrink-0 accent-plum"
            />
          </label>
          <p className="mt-1 text-[12px] text-mute">
            We&apos;ll email them what changed. Worth doing for a time or venue move.
          </p>
          {notify && (
            <label className="mt-3 block">
              <span className="label block">Add a note (optional)</span>
              <textarea
                name="notifyMessage"
                rows={2}
                placeholder="Sorry for the change — the venue moved us to the main hall."
                className="field resize-none"
              />
            </label>
          )}
        </div>
      )}

      {state.error && (
        <p role="alert" className="mb-3 text-[13px] font-medium text-[#B23A0A]">
          {state.error}
        </p>
      )}
      {state.ok && state.message && (
        <p role="status" className="mb-3 text-[13px] font-medium text-leaf">
          {state.message}
          {notify && " · attendees notified"}
        </p>
      )}

      <button type="submit" disabled={pending} className={btnClass("flame")}>
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
