"use client";

import { useEffect, useState } from "react";

import { addToCart, readCart, setQuantity } from "@/lib/cart";
import { btnClass } from "./ui";

export function AddToCart({
  product,
  eventSlug,
}: {
  product: {
    productId: string;
    shopId: string;
    shopSlug: string;
    shopName: string;
    name: string;
    priceKobo: number;
    emoji: string | null;
    maxQuantity: number;
  };
  eventSlug: string;
}) {
  const [quantity, setLocalQuantity] = useState(0);

  useEffect(() => {
    const sync = () => {
      const cart = readCart();
      const line =
        cart.eventSlug === eventSlug
          ? cart.items.find((i) => i.productId === product.productId)
          : undefined;
      setLocalQuantity(line?.quantity ?? 0);
    };
    sync();
    window.addEventListener("earnival:cart", sync);
    return () => window.removeEventListener("earnival:cart", sync);
  }, [eventSlug, product.productId]);

  if (product.maxQuantity <= 0) {
    return <span className="text-[12px] font-semibold uppercase text-mute">Sold out</span>;
  }

  if (quantity === 0) {
    return (
      <button
        type="button"
        onClick={() => addToCart(product, eventSlug)}
        className={btnClass("ghost", { full: false, small: true })}
      >
        Add
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border-[1.5px] border-night px-2 py-1">
      <button
        type="button"
        onClick={() => setQuantity(product.productId, quantity - 1)}
        aria-label={`Remove one ${product.name}`}
        className="grid h-9 w-9 place-items-center text-lg leading-none"
      >
        −
      </button>
      <span className="w-4 text-center text-sm font-bold tabular-nums">{quantity}</span>
      <button
        type="button"
        onClick={() => setQuantity(product.productId, quantity + 1)}
        disabled={quantity >= product.maxQuantity}
        aria-label={`Add one ${product.name}`}
        className="grid h-9 w-9 place-items-center text-lg leading-none disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}
