"use client";

import { useActionState, useState } from "react";

import { createEventAction, type ActionState } from "@/app/actions";
import { buyerTotal, formatNaira, nairaToKobo } from "@/lib/money";
import { ImageUpload } from "./ImageUpload";
import { btnClass } from "./ui";

const CATEGORIES = [
  "Party",
  "Concert",
  "Art & Exhibition",
  "Food Festival",
  "Market / Pop-up",
  "Sport",
];

interface TicketDraft {
  key: string;
  name: string;
  price: string;
  quantity: string;
}

export function EventForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createEventAction,
    {},
  );
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [tickets, setTickets] = useState<TicketDraft[]>([
    { key: "t1", name: "Regular", price: "5000", quantity: "100" },
  ]);

  function updateTicket(key: string, patch: Partial<TicketDraft>) {
    setTickets((prev) => prev.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  }

  return (
    <form action={formAction} className="px-4 pb-24 pt-4">
      <p className="mb-4 text-[13px] text-mute">
        Publish and you get a shareable link plus a QR code immediately.
      </p>

      <label className="mb-4 block">
        <span className="label block">Event name</span>
        <input
          required
          name="name"
          placeholder="NYE Rooftop Countdown"
          className="field"
        />
      </label>

      <div className="label">Category</div>
      <div className="mb-4 flex flex-wrap gap-2">
        {CATEGORIES.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setCategory(option)}
            aria-pressed={category === option}
            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
              category === option
                ? "bg-night text-white"
                : "border-[1.5px] border-line bg-white text-night"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
      <input type="hidden" name="category" value={category} />

      <div className="grid grid-cols-2 gap-3">
        <label className="mb-4 block">
          <span className="label block">Date</span>
          <input required type="date" name="date" className="field" />
        </label>
        <label className="mb-4 block">
          <span className="label block">Start time</span>
          <input
            required
            type="time"
            name="time"
            defaultValue="18:00"
            className="field"
          />
        </label>
      </div>

      <label className="mb-4 block">
        <span className="label block">Venue</span>
        <input
          required
          name="venue"
          placeholder="Landmark Beach, Oniru, Lagos"
          className="field"
        />
      </label>

      <ImageUpload
        name="bannerUrl"
        label="Event banner"
        hint="This is the image people see when your link lands in a WhatsApp group. Worth getting right."
        aspect="wide"
      />

      <label className="mb-4 block">
        <span className="label block">About it (optional)</span>
        <textarea
          name="description"
          rows={3}
          placeholder="What should people expect?"
          className="field resize-none"
        />
      </label>

      <div className="label">Tickets</div>
      <div className="mb-2 space-y-2">
        {tickets.map((ticket) => {
          const priceKobo = nairaToKobo(Number(ticket.price) || 0);
          return (
            <div
              key={ticket.key}
              className="rounded-2xl border-[1.5px] border-line bg-white p-3.5"
            >
              <div className="grid grid-cols-5 gap-2">
                <input
                  name="ticketName"
                  value={ticket.name}
                  onChange={(e) => updateTicket(ticket.key, { name: e.target.value })}
                  placeholder="Ticket name"
                  aria-label="Ticket name"
                  className="col-span-2 rounded-xl border-[1.5px] border-line px-3 py-2 text-[14px] outline-none"
                />
                <input
                  name="ticketPrice"
                  value={ticket.price}
                  onChange={(e) =>
                    updateTicket(ticket.key, {
                      price: e.target.value.replace(/\D/g, ""),
                    })
                  }
                  inputMode="numeric"
                  placeholder="Price ₦"
                  aria-label="Ticket price in naira"
                  className="col-span-2 rounded-xl border-[1.5px] border-line px-3 py-2 font-mono text-[14px] outline-none"
                />
                <input
                  name="ticketQuantity"
                  value={ticket.quantity}
                  onChange={(e) =>
                    updateTicket(ticket.key, {
                      quantity: e.target.value.replace(/\D/g, ""),
                    })
                  }
                  inputMode="numeric"
                  placeholder="Qty"
                  aria-label="Quantity available"
                  className="rounded-xl border-[1.5px] border-line px-3 py-2 font-mono text-[14px] outline-none"
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[12px] text-mute">
                <span>
                  {priceKobo === 0
                    ? "Free ticket"
                    : `Buyer pays ${formatNaira(buyerTotal(priceKobo, 150).totalKobo)} incl. processing`}
                </span>
                {tickets.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setTickets((prev) => prev.filter((t) => t.key !== ticket.key))
                    }
                    className="font-semibold text-[#B23A0A]"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() =>
          setTickets((prev) => [
            ...prev,
            {
              key: `t${Date.now()}`,
              name: "",
              price: "",
              quantity: "50",
            },
          ])
        }
        className="mb-5 text-[13px] font-semibold text-plum"
      >
        + Add ticket type
      </button>

      <label className="mb-4 block">
        <span className="label block">Note shown after purchase (optional)</span>
        <input
          name="organiserNote"
          placeholder="Gates open 2pm. Bring ID."
          className="field"
        />
      </label>

      <div className="mb-4 rounded-2xl border-[1.5px] border-line bg-white px-4 py-3 text-[13px]">
        <div className="flex justify-between py-0.5">
          <span className="text-mute">Visibility</span>
          <b>Public · discoverable</b>
        </div>
        <div className="flex justify-between py-0.5">
          <span className="text-mute">Service charge</span>
          <b>7.5% (Starter)</b>
        </div>
        <div className="flex justify-between py-0.5">
          <span className="text-mute">Processing</span>
          <b>1.5% · paid by buyer</b>
        </div>
      </div>

      {state.error && (
        <p role="alert" className="mb-3 text-[13px] font-medium text-[#B23A0A]">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={btnClass("flame")}>
        {pending ? "Publishing…" : "Publish & get my link"}
      </button>
    </form>
  );
}
