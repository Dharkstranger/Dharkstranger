"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { cartCount, cartSubtotal, readCart, type Cart } from "@/lib/cart";
import { formatNaira } from "@/lib/money";

/** Floating basket summary, shown once the shopper has something in the cart. */
export function BasketBar({ eventSlug }: { eventSlug: string }) {
  const [cart, setCart] = useState<Cart | null>(null);

  useEffect(() => {
    const sync = () => setCart(readCart());
    sync();
    window.addEventListener("earnival:cart", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("earnival:cart", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (!cart || cart.eventSlug !== eventSlug) return null;
  const count = cartCount(cart);
  if (count === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md p-4">
      <Link
        href={`/e/${eventSlug}/basket`}
        className="flex items-center justify-between rounded-2xl bg-night px-4 py-3.5 text-white shadow-xl"
      >
        <span className="text-sm font-semibold">
          🛍️ {count} item{count > 1 ? "s" : ""}
        </span>
        <span className="text-sm font-bold text-marigold">
          {formatNaira(cartSubtotal(cart))} · Basket →
        </span>
      </Link>
    </div>
  );
}
