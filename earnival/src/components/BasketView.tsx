"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  cartSubtotal,
  groupByShop,
  readCart,
  setQuantity,
  type Cart,
} from "@/lib/cart";
import { buyerTotal, formatNaira } from "@/lib/money";
import { btnClass } from "./ui";

interface ShopView {
  id: string;
  name: string;
  payAtEvent: boolean;
}

export function BasketView({
  eventSlug,
  processingFeeBps,
  shops,
}: {
  eventSlug: string;
  processingFeeBps: number;
  shops: ShopView[];
}) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [buyer, setBuyer] = useState({ name: "", email: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setCart(readCart());
    sync();
    window.addEventListener("earnival:cart", sync);
    return () => window.removeEventListener("earnival:cart", sync);
  }, []);

  if (!cart) return <div className="px-4 py-10 text-[13px] text-mute">Loading…</div>;

  const items = cart.eventSlug === eventSlug ? cart.items : [];

  if (items.length === 0) {
    return (
      <div className="px-6 py-14 text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-haze text-2xl">
          🛍️
        </div>
        <div className="font-display text-[16px] font-bold">Basket&apos;s empty</div>
        <p className="mx-auto mb-4 mt-1 max-w-[260px] text-[13px] text-mute">
          Add something from the event shops.
        </p>
        <Link href={`/e/${eventSlug}`} className={btnClass("flame", { full: false })}>
          Back to the event
        </Link>
      </div>
    );
  }

  const grouped = groupByShop({ ...cart, items });
  const subtotal = cartSubtotal({ ...cart, items });
  const totals = buyerTotal(subtotal, processingFeeBps);
  const multiShop = grouped.size > 1;

  // Pay-at-event is only offered when every shop in the basket allows it.
  const allowPayAtEvent = [...grouped.keys()].every(
    (shopId) => shops.find((s) => s.id === shopId)?.payAtEvent ?? false,
  );

  async function checkout(payNow: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventSlug,
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          buyer,
          payNow,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not start checkout");
        setBusy(false);
        return;
      }
      window.localStorage.removeItem("earnival-cart-v1");
      window.location.href = data.redirectUrl;
    } catch {
      setError("Network problem — check your connection and try again");
      setBusy(false);
    }
  }

  const formValid = buyer.name.trim().length >= 2 && /\S+@\S+\.\S+/.test(buyer.email);

  return (
    <div className="px-4 pb-24 pt-3">
      {multiShop && (
        <p className="mb-2 text-[12px] text-plum">
          ✨ From {grouped.size} shops — one basket, split per shop. Each vendor sees
          only their own items.
        </p>
      )}

      {[...grouped.entries()].map(([shopId, shopItems]) => (
        <div
          key={shopId}
          className="mb-2 rounded-2xl border-[1.5px] border-line bg-white p-3.5"
        >
          <div className="mb-1 text-[12px] font-bold uppercase tracking-wider text-mute">
            {shopItems[0].shopName}
          </div>
          {shopItems.map((item) => (
            <div
              key={item.productId}
              className="flex items-center justify-between py-1 text-[13px]"
            >
              <span className="min-w-0 truncate">
                {item.emoji ?? "🛍️"} {item.name}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantity(item.productId, item.quantity - 1)}
                  aria-label={`Remove one ${item.name}`}
                  className="grid h-9 w-9 place-items-center text-base leading-none"
                >
                  −
                </button>
                <span className="w-4 text-center tabular-nums">{item.quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(item.productId, item.quantity + 1)}
                  disabled={item.quantity >= item.maxQuantity}
                  aria-label={`Add one ${item.name}`}
                  className="grid h-9 w-9 place-items-center text-base leading-none disabled:opacity-30"
                >
                  +
                </button>
                <span className="ml-1 w-16 text-right font-mono">
                  {formatNaira(item.priceKobo * item.quantity)}
                </span>
              </span>
            </div>
          ))}
        </div>
      ))}

      <div className="mb-4 mt-4">
        <label className="mb-3 block">
          <span className="label block">Full name</span>
          <input
            value={buyer.name}
            onChange={(e) => setBuyer({ ...buyer, name: e.target.value })}
            placeholder="Zainab Oladipo"
            className="field"
          />
        </label>
        <label className="mb-3 block">
          <span className="label block">Email — your receipt goes here</span>
          <input
            type="email"
            value={buyer.email}
            onChange={(e) => setBuyer({ ...buyer, email: e.target.value })}
            placeholder="you@mail.com"
            className="field"
          />
        </label>
        <label className="block">
          <span className="label block">Phone</span>
          <input
            type="tel"
            value={buyer.phone}
            onChange={(e) => setBuyer({ ...buyer, phone: e.target.value })}
            placeholder="+234 800 000 0000"
            className="field"
          />
        </label>
      </div>

      <div className="mb-3 rounded-2xl border-[1.5px] border-line bg-white px-4 py-3 text-[13px]">
        <div className="flex justify-between py-1">
          <span>Subtotal</span>
          <span className="font-mono">{formatNaira(totals.subtotalKobo)}</span>
        </div>
        <div className="flex justify-between py-1 text-mute">
          <span>Processing ({processingFeeBps / 100}%)</span>
          <span className="font-mono">{formatNaira(totals.processingFeeKobo)}</span>
        </div>
        <div className="flex justify-between border-t-[1.5px] border-line py-1.5 font-bold">
          <span>Total now</span>
          <span className="font-mono">{formatNaira(totals.totalKobo)}</span>
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-3 text-[13px] font-medium text-[#B23A0A]">
          {error}
        </p>
      )}

      <div className="space-y-2">
        <button
          type="button"
          disabled={busy || !formValid}
          onClick={() => checkout(true)}
          className={btnClass("flame")}
        >
          {busy ? "Starting checkout…" : `Pay now ${formatNaira(totals.totalKobo)}`}
        </button>
        {allowPayAtEvent && (
          <button
            type="button"
            disabled={busy || !formValid}
            onClick={() => checkout(false)}
            className={btnClass("ghost")}
          >
            Create order — pay at the event
          </button>
        )}
      </div>

      <p className="mt-2 text-[12px] text-mute">
        Orders lock once paid. Collect at the event with your pickup code.
      </p>
    </div>
  );
}
