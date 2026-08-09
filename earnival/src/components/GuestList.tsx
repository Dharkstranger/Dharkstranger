"use client";

import { useMemo, useState } from "react";

import { submitCheckIn } from "@/lib/checkin-client";
import { Chip, btnClass } from "./ui";

interface Guest {
  id: string;
  name: string;
  email: string;
  code: string;
  ticketTypeName: string;
  checkedIn: boolean;
}

export function GuestList({ eventId, guests }: { eventId: string; guests: Guest[] }) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return guests;
    return guests.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.email.toLowerCase().includes(q) ||
        g.code.toLowerCase().includes(q),
    );
  }, [guests, query]);

  async function checkIn(guest: Guest) {
    setBusy(guest.id);
    const result = await submitCheckIn({ eventId, code: guest.code });
    setBusy(null);
    setToast(result.message);
    setTimeout(() => setToast(null), 2500);
    if (result.ok) setState((prev) => ({ ...prev, [guest.id]: true }));
  }

  if (guests.length === 0) {
    return (
      <p className="text-[13px] text-mute">
        No guests yet — share your link and watch this fill up.
      </p>
    );
  }

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search name, email or code…"
        aria-label="Search guests"
        className="field mb-2"
      />

      {toast && (
        <div
          role="status"
          className="mb-2 rounded-2xl bg-night px-4 py-2.5 text-[13px] font-semibold text-white"
        >
          {toast}
        </div>
      )}

      <ul className="space-y-2 md:grid md:grid-cols-2 md:gap-2 md:space-y-0 xl:grid-cols-3">
        {filtered.map((guest) => {
          const isIn = guest.checkedIn || state[guest.id];
          return (
            <li
              key={guest.id}
              className="flex items-center justify-between gap-2 rounded-2xl border-[1.5px] border-line bg-white px-4 py-3"
            >
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold">{guest.name}</div>
                <div className="text-[12px] text-mute">
                  {guest.ticketTypeName} ·{" "}
                  <span className="font-mono">{guest.code}</span>
                </div>
              </div>
              {isIn ? (
                <Chip tone="leaf">In</Chip>
              ) : (
                <button
                  type="button"
                  disabled={busy === guest.id}
                  onClick={() => checkIn(guest)}
                  className={btnClass("ghost", { full: false, small: true })}
                >
                  {busy === guest.id ? "…" : "Check in"}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {filtered.length === 0 && (
        <p className="py-4 text-center text-[13px] text-mute">No guest matches that.</p>
      )}
    </div>
  );
}
