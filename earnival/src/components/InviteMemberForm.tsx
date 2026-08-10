"use client";

import { useActionState, useState } from "react";

import { inviteEventMemberAction, type ActionState } from "@/app/actions";
import { btnClass } from "./ui";

export function InviteMemberForm({ eventId }: { eventId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    inviteEventMemberAction,
    {},
  );
  const [role, setRole] = useState<"DOOR_STAFF" | "COHOST">("DOOR_STAFF");
  const [earns, setEarns] = useState(false);
  const [shareType, setShareType] = useState<"PERCENT" | "FLAT">("PERCENT");

  return (
    <form
      action={formAction}
      className="rounded-2xl border-[1.5px] border-dashed border-line bg-white p-4"
    >
      <input type="hidden" name="eventId" value={eventId} />

      <label className="mb-3 block">
        <span className="label block">Their email</span>
        <input
          required
          name="email"
          type="email"
          placeholder="doorstaff@mail.com"
          className="field"
        />
      </label>

      <div className="label">Role</div>
      <div className="mb-3 flex gap-2">
        {(
          [
            ["DOOR_STAFF", "Door staff"],
            ["COHOST", "Cohost"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setRole(value)}
            aria-pressed={role === value}
            className={`rounded-full px-4 py-1.5 text-[13px] font-semibold ${
              role === value
                ? "bg-night text-white"
                : "border-[1.5px] border-line bg-white text-night"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <input type="hidden" name="role" value={role} />

      <fieldset className="mb-3">
        <legend className="label">What they can do</legend>
        <div className="space-y-2">
          {(
            [
              ["canCheckIn", "Check guests in", true],
              ["canEditEvent", "Edit the event", false],
              ["canManageShops", "Accept and manage shops", false],
              ["canRefund", "Issue refunds", false],
            ] as const
          ).map(([name, label, defaultChecked]) => (
            <label
              key={name}
              className="flex items-center justify-between rounded-xl bg-paper px-3 py-2.5 text-[13px]"
            >
              <span>{label}</span>
              <input
                type="checkbox"
                name={name}
                defaultChecked={defaultChecked}
                className="h-5 w-5 accent-plum"
              />
            </label>
          ))}
        </div>
      </fieldset>

      {role === "COHOST" && (
        <fieldset className="mb-3">
          <legend className="label">Revenue</legend>
          <label className="flex items-center justify-between rounded-xl bg-paper px-3 py-2.5 text-[13px]">
            <span>They earn a share</span>
            <input
              type="checkbox"
              name="earns"
              checked={earns}
              onChange={(e) => setEarns(e.target.checked)}
              className="h-5 w-5 accent-leaf"
            />
          </label>

          {earns && (
            <div className="mt-2 rounded-xl bg-paper p-3">
              <div className="mb-2 flex gap-2">
                {(
                  [
                    ["PERCENT", "Percentage"],
                    ["FLAT", "Flat fee"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setShareType(value)}
                    aria-pressed={shareType === value}
                    className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                      shareType === value
                        ? "bg-night text-white"
                        : "border-[1.5px] border-line bg-white text-night"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <input type="hidden" name="shareType" value={shareType} />

              {shareType === "PERCENT" ? (
                <label className="mb-2 block">
                  <span className="label block">Percentage</span>
                  <input
                    name="sharePct"
                    inputMode="decimal"
                    defaultValue="10"
                    className="field font-mono"
                  />
                </label>
              ) : (
                <label className="mb-2 block">
                  <span className="label block">Amount (₦, one-off)</span>
                  <input
                    name="shareFlatNaira"
                    inputMode="numeric"
                    defaultValue="50000"
                    className="field font-mono"
                  />
                </label>
              )}

              <label className="block">
                <span className="label block">Applied to</span>
                <select name="revenueLine" className="field">
                  <option value="TICKET_SALES">Ticket revenue</option>
                  <option value="SHOP_SHARE">Your share of shop sales</option>
                  <option value="SPONSOR">Sponsorship</option>
                </select>
              </label>

              <p className="mt-2 text-[12px] text-mute">
                Paid out of your share — vendors are never affected.
              </p>
            </div>
          )}
        </fieldset>
      )}

      {state.error && (
        <p role="alert" className="mb-2 text-[13px] font-medium text-[#B23A0A]">
          {state.error}
        </p>
      )}
      {state.ok && state.message && (
        <p role="status" className="mb-2 text-[13px] font-medium text-leaf">
          {state.message}
        </p>
      )}

      <button type="submit" disabled={pending} className={btnClass("flame")}>
        {pending ? "Sending…" : "Send invitation"}
      </button>
    </form>
  );
}
