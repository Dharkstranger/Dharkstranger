"use client";

/**
 * Basket state, held in localStorage so it survives a reload and the round trip
 * out to Paystack. Prices here are for display only — the server recomputes
 * every total from the database at checkout.
 */

const KEY = "earnival-cart-v1";

export interface CartItem {
  productId: string;
  shopId: string;
  shopSlug: string;
  shopName: string;
  name: string;
  priceKobo: number;
  emoji: string | null;
  quantity: number;
  maxQuantity: number;
}

export interface Cart {
  eventSlug: string | null;
  items: CartItem[];
}

const EMPTY: Cart = { eventSlug: null, items: [] };

export function readCart(): Cart {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Cart;
    if (!Array.isArray(parsed.items)) return EMPTY;
    return parsed;
  } catch {
    return EMPTY;
  }
}

export function writeCart(cart: Cart): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cart));
    window.dispatchEvent(new CustomEvent("earnival:cart"));
  } catch {
    // Storage full or blocked (private browsing) — the basket just won't persist.
  }
}

export function addToCart(item: Omit<CartItem, "quantity">, eventSlug: string): Cart {
  const current = readCart();
  // Switching events starts a fresh basket; an order can only target one event.
  const base: Cart =
    current.eventSlug && current.eventSlug !== eventSlug
      ? { eventSlug, items: [] }
      : { eventSlug, items: current.items };

  const existing = base.items.find((i) => i.productId === item.productId);
  const next: Cart = existing
    ? {
        ...base,
        items: base.items.map((i) =>
          i.productId === item.productId
            ? { ...i, quantity: Math.min(i.quantity + 1, i.maxQuantity) }
            : i,
        ),
      }
    : { ...base, items: [...base.items, { ...item, quantity: 1 }] };

  writeCart(next);
  return next;
}

export function setQuantity(productId: string, quantity: number): Cart {
  const current = readCart();
  const next: Cart = {
    ...current,
    items: current.items
      .map((i) =>
        i.productId === productId
          ? { ...i, quantity: Math.max(0, Math.min(quantity, i.maxQuantity)) }
          : i,
      )
      .filter((i) => i.quantity > 0),
  };
  writeCart(next);
  return next;
}

export function clearCart(): void {
  writeCart(EMPTY);
}

export function cartCount(cart: Cart): number {
  return cart.items.reduce((a, i) => a + i.quantity, 0);
}

export function cartSubtotal(cart: Cart): number {
  return cart.items.reduce((a, i) => a + i.priceKobo * i.quantity, 0);
}

export function groupByShop(cart: Cart): Map<string, CartItem[]> {
  const map = new Map<string, CartItem[]>();
  for (const item of cart.items) {
    map.set(item.shopId, [...(map.get(item.shopId) ?? []), item]);
  }
  return map;
}
