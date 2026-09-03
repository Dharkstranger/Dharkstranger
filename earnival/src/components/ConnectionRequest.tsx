"use client";

import { useActionState } from "react";

import { respondToConnectionAction, type ActionState } from "@/app/actions";
import { nairaToKobo, splitSale } from "@/lib/money";
import { Chip, Receipt, btnClass } from "./ui";

/**
 * PRD CON-05: "financial implications must be visible before acceptance — no
 * blind accepts". The organiser sees the exact split on a worked example
 * before they can say yes.
 */
export function ConnectionRequest({
  connectionId,
  shopName,
  productCount,
  sharePct,
  serviceFeeBps,
}: {
  connectionId: string;
  shopName: string;
  productCount: number;
  sharePct: number;
  serviceFeeBps: number;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    respondToConnectionAction,
    {},
  );

  const example = nairaToKobo(12_000);
  const split = splitSale({
    grossKobo: example,
    serviceFeeBps,
    revenueShareBps: Math.round(sharePct * 100),
  });

  return (
    <div className="mb-3 rounded-3xl border-[1.5px] border-marigold bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="font-display text-[14px] font-bold">{shopName} → your event</div>
        <Chip tone="gold">Request</Chip>
      </div>
      <div className="mt-1 text-[12px] text-mute">{productCount} products</div>

      <Receipt
        title="If they sell a ₦12,000 item"
        lines={[
          { label: "Sale", kobo: split.grossKobo, strong: true },
          {
            label: `Service charge (${serviceFeeBps / 100}%)`,
            kobo: -split.serviceFeeKobo,
          },
          { label: `Your share (${sharePct}%)`, kobo: split.organiserShareKobo },
        ]}
        total={{ label: "Vendor settles T+1", kobo: split.vendorNetKobo }}
      />

      {state.error && (
        <p role="alert" className="mb-2 text-[13px] font-medium text-[#B23A0A]">
          {state.error}
        </p>
      )}

      <form action={formAction} className="flex gap-2">
        <input type="hidden" name="connectionId" value={connectionId} />
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
      </form>
    </div>
  );
}
