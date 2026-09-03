"use client";

import { useActionState, useState } from "react";

import { updateProductAction, type ActionState } from "@/app/actions";
import { formatNaira } from "@/lib/money";
import { Chip, btnClass } from "./ui";
import { ImageUpload } from "./ImageUpload";

export interface ProductView {
  id: string;
  name: string;
  priceKobo: number;
  stock: number;
  reserved: number;
  emoji: string | null;
  imageUrl: string | null;
  active: boolean;
  lowStockThreshold: number;
}

export function ProductRow({ product }: { product: ProductView }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateProductAction,
    {},
  );
  const [open, setOpen] = useState(false);

  const available = product.stock - product.reserved;

  if (!open) {
    return (
      <div className="flex items-center justify-between rounded-2xl border-[1.5px] border-line bg-white px-4 py-2.5">
        <span className="flex min-w-0 items-center gap-2.5">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt=""
              loading="lazy"
              className="h-9 w-9 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <span aria-hidden className="text-[18px]">
              {product.emoji ?? "🛍️"}
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-semibold">
              {product.name}
            </span>
            <span
              className={`block text-[12px] ${
                available <= product.lowStockThreshold ? "text-[#B23A0A]" : "text-mute"
              }`}
            >
              {available} left · {formatNaira(product.priceKobo)}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {!product.active && <Chip tone="line">Hidden</Chip>}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-[13px] font-semibold text-plum"
          >
            Edit
          </button>
        </span>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="rounded-2xl border-[1.5px] border-plum bg-white p-3.5"
    >
      <input type="hidden" name="productId" value={product.id} />

      <ImageUpload
        name="imageUrl"
        label="Photo"
        defaultValue={product.imageUrl}
        aspect="square"
        maxEdge={800}
      />

      <div className="grid grid-cols-6 gap-2">
        <input
          name="emoji"
          defaultValue={product.emoji ?? ""}
          placeholder="🍢"
          aria-label="Emoji"
          maxLength={4}
          className="rounded-xl border-[1.5px] border-line px-2 py-2 text-center text-[15px] outline-none"
        />
        <input
          required
          name="name"
          defaultValue={product.name}
          aria-label="Product name"
          className="col-span-3 rounded-xl border-[1.5px] border-line px-3 py-2 text-[13px] outline-none"
        />
        <input
          required
          name="price"
          defaultValue={product.priceKobo / 100}
          inputMode="numeric"
          aria-label="Price in naira"
          className="rounded-xl border-[1.5px] border-line px-2 py-2 font-mono text-[13px] outline-none"
        />
        <input
          required
          name="stock"
          defaultValue={product.stock}
          inputMode="numeric"
          aria-label="Stock"
          className="rounded-xl border-[1.5px] border-line px-2 py-2 font-mono text-[13px] outline-none"
        />
      </div>

      <label className="mt-2 block">
        <span className="label block">Warn me when stock hits</span>
        <input
          name="lowStockThreshold"
          defaultValue={product.lowStockThreshold}
          inputMode="numeric"
          className="field font-mono"
        />
      </label>

      <label className="mt-2 flex items-center justify-between rounded-xl bg-paper px-3 py-2 text-[13px]">
        <span>Visible in the shop</span>
        <input
          type="checkbox"
          name="active"
          defaultChecked={product.active}
          className="h-5 w-5 accent-leaf"
        />
      </label>

      {product.reserved > 0 && (
        <p className="mt-2 text-[12px] text-mute">
          {product.reserved} held by checkouts in progress — stock can&apos;t go below
          that.
        </p>
      )}

      {state.error && (
        <p role="alert" className="mt-2 text-[12px] font-medium text-[#B23A0A]">
          {state.error}
        </p>
      )}

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={btnClass("quiet", { small: true })}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className={btnClass("primary", { small: true })}
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
