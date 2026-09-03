"use client";

import { useState } from "react";
import { formatNaira, buyerTotal } from "@/lib/money";
import { PolicyNote } from "./PolicyNote";
import { btnClass } from "./ui";

interface TicketTypeView {
  id: string;
  name: string;
  priceKobo: number;
  remaining: number;
}

export function TicketPicker({
  eventSlug,
  eventId,
  ticketTypes,
}: {
  eventSlug: string;
  eventId: string;
  ticketTypes: TicketTypeView[];
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [buyer, setBuyer] = useState({ name: "", email: "", phone: "" });
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lines = ticketTypes
    .map((t) => ({ type: t, quantity: quantities[t.id] ?? 0 }))
    .filter((l) => l.quantity > 0);

  const subtotal = lines.reduce((a, l) => a + l.type.priceKobo * l.quantity, 0);
  const totals = buyerTotal(subtotal, 150);
  const count = lines.reduce((a, l) => a + l.quantity, 0);

  function adjust(type: TicketTypeView, delta: number) {
    setQuantities((prev) => {
      const next = Math.max(0, Math.min((prev[type.id] ?? 0) + delta, type.remaining));
      return { ...prev, [type.id]: next };
    });
  }

  async function submit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventSlug,
          lines: lines.map((l) => ({ ticketTypeId: l.type.id, quantity: l.quantity })),
          buyer,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not start checkout");
        setBusy(false);
        return;
      }
      // Leave `busy` set: we are navigating away, and re-enabling the button
      // here is how double-charges happen.
      window.location.href = data.redirectUrl;
    } catch {
      setError("Network problem — check your connection and try again");
      setBusy(false);
    }
  }

  return (
    <div className="mt-2">
      <ul className="space-y-2">
        {ticketTypes.map((type) => {
          const quantity = quantities[type.id] ?? 0;
          const soldOut = type.remaining <= 0;
          return (
            <li
              key={type.id}
              className="flex items-center justify-between rounded-2xl border-[1.5px] border-line bg-white px-4 py-3"
            >
              <div>
                <div className="text-[14px] font-semibold">{type.name}</div>
                <div className="text-[12px] text-mute">
                  {soldOut ? "Sold out" : `${type.remaining} left`}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[14px] font-bold">
                  {type.priceKobo === 0 ? "Free" : formatNaira(type.priceKobo)}
                </span>
                {soldOut ? (
                  <span className="text-[12px] font-semibold uppercase text-mute">
                    Gone
                  </span>
                ) : quantity > 0 ? (
                  <div className="flex items-center gap-2 rounded-xl border-[1.5px] border-night px-2 py-1">
                    <button
                      type="button"
                      onClick={() => adjust(type, -1)}
                      aria-label={`Remove one ${type.name}`}
                      className="grid h-9 w-9 place-items-center text-lg leading-none"
                    >
                      −
                    </button>
                    <span className="w-4 text-center text-sm font-bold tabular-nums">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => adjust(type, 1)}
                      disabled={quantity >= type.remaining}
                      aria-label={`Add one ${type.name}`}
                      className="grid h-9 w-9 place-items-center text-lg leading-none disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => adjust(type, 1)}
                    className={btnClass("flame", { full: false, small: true })}
                  >
                    Get
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {count > 0 && !showForm && (
        <button
          type="button"
          onClick={() => {
            setShowForm(true);
            void fetch("/api/track", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: "ticket.checkout_started",
                eventId,
              }),
            }).catch(() => {});
          }}
          className={`${btnClass("flame")} mt-3`}
        >
          Continue · {formatNaira(totals.totalKobo)}
        </button>
      )}

      {count > 0 && showForm && (
        <form onSubmit={submit} className="mt-4">
          <p className="mb-3 text-[12px] text-mute">
            Guest checkout — no account, no password.
          </p>

          <label className="mb-3 block">
            <span className="label block">Full name</span>
            <input
              required
              minLength={2}
              value={buyer.name}
              onChange={(e) => setBuyer({ ...buyer, name: e.target.value })}
              placeholder="Zainab Oladipo"
              className="field"
            />
          </label>

          <label className="mb-3 block">
            <span className="label block">Email — your ticket goes here</span>
            <input
              required
              type="email"
              value={buyer.email}
              onChange={(e) => setBuyer({ ...buyer, email: e.target.value })}
              placeholder="you@mail.com"
              className="field"
            />
          </label>

          <label className="mb-3 block">
            <span className="label block">Phone</span>
            <input
              type="tel"
              value={buyer.phone}
              onChange={(e) => setBuyer({ ...buyer, phone: e.target.value })}
              placeholder="+234 800 000 0000"
              className="field"
            />
          </label>

          <div className="mb-3 rounded-2xl border-[1.5px] border-line bg-white px-4 py-3 text-[13px]">
            {lines.map((l) => (
              <div key={l.type.id} className="flex justify-between py-1">
                <span>
                  {l.type.name} ×{l.quantity}
                </span>
                <span className="font-mono">
                  {formatNaira(l.type.priceKobo * l.quantity)}
                </span>
              </div>
            ))}
            <div className="flex justify-between py-1 text-mute">
              <span>Processing (1.5%)</span>
              <span className="font-mono">{formatNaira(totals.processingFeeKobo)}</span>
            </div>
            <div className="flex justify-between border-t-[1.5px] border-line py-1.5 font-bold">
              <span>Total</span>
              <span className="font-mono">{formatNaira(totals.totalKobo)}</span>
            </div>
          </div>

          {error && (
            <p role="alert" className="mb-3 text-[13px] font-medium text-[#B23A0A]">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className={btnClass("flame")}>
            {busy ? "Starting checkout…" : `Pay ${formatNaira(totals.totalKobo)}`}
          </button>
          <p className="mt-2 text-center text-[12px] text-mute">
            Secured by Paystack
          </p>
          <PolicyNote context="ticket" />
        </form>
      )}
    </div>
  );
}
