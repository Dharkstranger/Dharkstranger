"use client";

import { useActionState, useState } from "react";

import { saveTicketTypeAction, type ActionState } from "@/app/actions";
import { Chip, btnClass } from "./ui";

interface TicketTypeView {
  id: string;
  name: string;
  priceNaira: number;
  quantity: number;
  sold: number;
  reserved: number;
  active: boolean;
}

function TicketTypeRow({
  eventId,
  type,
}: {
  eventId: string;
  type: TicketTypeView;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveTicketTypeAction,
    {},
  );
  const [open, setOpen] = useState(false);

  const committed = type.sold + type.reserved;

  if (!open) {
    return (
      <div className="flex items-center justify-between rounded-2xl border-[1.5px] border-line bg-white px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold">{type.name}</div>
          <div className="text-[12px] text-mute">
            ₦{type.priceNaira.toLocaleString("en-NG")} · {type.sold}/{type.quantity} sold
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!type.active && <Chip tone="line">Hidden</Chip>}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-[13px] font-semibold text-plum"
          >
            Edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="rounded-2xl border-[1.5px] border-plum bg-white p-3.5">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="ticketTypeId" value={type.id} />

      <div className="grid grid-cols-5 gap-2">
        <input
          name="name"
          defaultValue={type.name}
          aria-label="Ticket name"
          className="col-span-2 rounded-xl border-[1.5px] border-line px-3 py-2 text-[14px] outline-none"
        />
        <input
          name="price"
          defaultValue={type.priceNaira}
          inputMode="numeric"
          aria-label="Price in naira"
          className="col-span-2 rounded-xl border-[1.5px] border-line px-3 py-2 font-mono text-[14px] outline-none"
        />
        <input
          name="quantity"
          defaultValue={type.quantity}
          inputMode="numeric"
          aria-label="Capacity"
          className="rounded-xl border-[1.5px] border-line px-3 py-2 font-mono text-[14px] outline-none"
        />
      </div>

      <label className="mt-2 flex items-center justify-between rounded-xl bg-paper px-3 py-2 text-[13px]">
        <span>On sale</span>
        <input
          type="checkbox"
          name="active"
          defaultChecked={type.active}
          className="h-5 w-5 accent-leaf"
        />
      </label>

      {committed > 0 && (
        <p className="mt-2 text-[12px] text-mute">
          {committed} already sold or held — capacity can&apos;t go below that.
        </p>
      )}

      {state.error && (
        <p role="alert" className="mt-2 text-[12px] font-medium text-[#B23A0A]">
          {state.error}
        </p>
      )}

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={btnClass("quiet", { small: true })}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className={btnClass("primary", { small: true })}
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

function AddTicketType({ eventId }: { eventId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveTicketTypeAction,
    {},
  );
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[13px] font-semibold text-plum"
      >
        + Add a ticket type
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="rounded-2xl border-[1.5px] border-dashed border-plum bg-white p-3.5"
    >
      <input type="hidden" name="eventId" value={eventId} />
      <div className="grid grid-cols-5 gap-2">
        <input
          required
          name="name"
          placeholder="Ticket name"
          aria-label="Ticket name"
          className="col-span-2 rounded-xl border-[1.5px] border-line px-3 py-2 text-[14px] outline-none"
        />
        <input
          required
          name="price"
          placeholder="Price ₦"
          inputMode="numeric"
          aria-label="Price in naira"
          className="col-span-2 rounded-xl border-[1.5px] border-line px-3 py-2 font-mono text-[14px] outline-none"
        />
        <input
          required
          name="quantity"
          placeholder="Qty"
          inputMode="numeric"
          aria-label="Capacity"
          className="rounded-xl border-[1.5px] border-line px-3 py-2 font-mono text-[14px] outline-none"
        />
      </div>
      <input type="hidden" name="active" value="on" />

      {state.error && (
        <p role="alert" className="mt-2 text-[12px] font-medium text-[#B23A0A]">
          {state.error}
        </p>
      )}

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={btnClass("quiet", { small: true })}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className={btnClass("flame", { small: true })}
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
    </form>
  );
}

export function TicketTypeEditor({
  eventId,
  ticketTypes,
}: {
  eventId: string;
  ticketTypes: TicketTypeView[];
}) {
  return (
    <div className="space-y-2">
      {ticketTypes.map((type) => (
        <TicketTypeRow key={type.id} eventId={eventId} type={type} />
      ))}
      <div className="pt-1">
        <AddTicketType eventId={eventId} />
      </div>
    </div>
  );
}
