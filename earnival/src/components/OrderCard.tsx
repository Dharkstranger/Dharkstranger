"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";

import { refundOrderAction, type ActionState } from "@/app/actions";
import { formatNaira } from "@/lib/money";
import { Chip, btnClass } from "./ui";

interface OrderView {
  id: string;
  reference: string;
  buyerName: string;
  status: string;
  totalKobo: number;
  paid: boolean;
  pickupCode: string | null;
  items: { name: string; quantity: number }[];
}

export function OrderCard({ order }: { order: OrderView }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickupCode, setPickupCode] = useState("");
  const [confirmingRefund, setConfirmingRefund] = useState(false);

  const [refundState, refundAction, refunding] = useActionState<ActionState, FormData>(
    refundOrderAction,
    {},
  );

  const needsCode = order.status === "READY";
  const refunded = order.status === "REFUNDED" || order.status === "PARTIALLY_REFUNDED";
  const terminal =
    order.status === "COMPLETED" || order.status === "CANCELLED" || refunded;

  async function advance() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/orders/advance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order.id,
        pickupCode: needsCode ? pickupCode : undefined,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not update");
      return;
    }
    setPickupCode("");
    router.refresh();
  }

  return (
    <div
      className={`rounded-2xl border-[1.5px] bg-white px-4 py-3 ${
        order.status === "COMPLETED" ? "border-line" : "border-marigold"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-mono text-[13px] font-semibold">
          {order.reference} · {order.buyerName}
        </span>
        <Chip
          tone={
            refunded
              ? "flame"
              : order.status === "COMPLETED"
                ? "leaf"
                : order.status === "READY"
                  ? "gold"
                  : "line"
          }
        >
          {order.status.toLowerCase().replace(/_/g, " ")}
        </Chip>
      </div>

      <div className="mt-0.5 text-[12px] text-mute">
        {order.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")} ·{" "}
        {formatNaira(order.totalKobo)} · {order.paid ? "paid" : "pay at event"}
      </div>

      {order.pickupCode && order.status === "READY" && (
        <div className="mt-1 text-[11px]">
          <Chip tone="gold">Buyer&apos;s code {order.pickupCode}</Chip>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-[12px] font-medium text-[#B23A0A]">
          {error}
        </p>
      )}

      {!terminal && (
        <div className="mt-2">
          {needsCode && (
            <input
              value={pickupCode}
              onChange={(e) => setPickupCode(e.target.value.toUpperCase())}
              placeholder="Enter buyer's pickup code"
              aria-label="Pickup code"
              className="field mb-2 font-mono text-[13px]"
            />
          )}
          <button
            type="button"
            disabled={busy || (needsCode && !pickupCode)}
            onClick={advance}
            className={btnClass("primary", { small: true })}
          >
            {busy
              ? "…"
              : needsCode
                ? "Verify pickup & complete"
                : "Mark ready — send pickup code"}
          </button>
        </div>
      )}

      {order.paid && !refunded && (
        <div className="mt-2">
          {confirmingRefund ? (
            <form action={refundAction} className="rounded-xl bg-paper p-2.5">
              <input type="hidden" name="orderId" value={order.id} />
              <p className="mb-2 text-[12px] text-mute">
                Refunding {formatNaira(order.totalKobo)} to {order.buyerName}. Your
                share and Earnival&apos;s fee are both returned.
              </p>
              <input
                name="note"
                placeholder="Reason (optional)"
                className="field mb-2 text-[13px]"
              />
              {refundState.error && (
                <p role="alert" className="mb-2 text-[12px] font-medium text-[#B23A0A]">
                  {refundState.error}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingRefund(false)}
                  className={btnClass("quiet", { small: true })}
                >
                  Keep it
                </button>
                <button
                  type="submit"
                  disabled={refunding}
                  className={btnClass("flame", { small: true })}
                >
                  {refunding ? "Refunding…" : "Refund in full"}
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingRefund(true)}
              className="text-[12px] font-semibold text-[#B23A0A]"
            >
              Refund this order
            </button>
          )}
        </div>
      )}
    </div>
  );
}
