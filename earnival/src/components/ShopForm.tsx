"use client";

import { useActionState, useState } from "react";

import { createShopAction, type ActionState } from "@/app/actions";
import { btnClass } from "./ui";

const CATEGORIES = ["Food & Drinks", "Fashion", "Art", "Beauty", "Other"];

export function ShopForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createShopAction,
    {},
  );
  const [category, setCategory] = useState(CATEGORIES[0]);

  return (
    <form action={formAction}>
      <label className="mb-4 block">
        <span className="label block">Shop name</span>
        <input required name="name" placeholder="Amara's Grill" className="field" />
      </label>

      <div className="label">Category</div>
      <div className="mb-4 flex flex-wrap gap-2">
        {CATEGORIES.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setCategory(option)}
            aria-pressed={category === option}
            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
              category === option
                ? "bg-night text-white"
                : "border-[1.5px] border-line bg-white text-night"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
      <input type="hidden" name="category" value={category} />

      <label className="mb-4 block">
        <span className="label block">What you sell (optional)</span>
        <textarea
          name="description"
          rows={2}
          placeholder="Suya, asun and cold drinks."
          className="field resize-none"
        />
      </label>

      <label className="mb-4 block">
        <span className="label block">WhatsApp for sale alerts</span>
        <input name="whatsapp" placeholder="+234 801 234 5678" className="field" />
      </label>

      <label className="mb-4 flex items-center justify-between rounded-2xl border-[1.5px] border-line bg-white px-4 py-3">
        <span className="text-[14px] font-semibold">Allow pay-at-event orders</span>
        <input
          type="checkbox"
          name="payAtEvent"
          defaultChecked
          className="h-5 w-5 accent-leaf"
        />
      </label>

      {state.error && (
        <p role="alert" className="mb-3 text-[13px] font-medium text-[#B23A0A]">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={btnClass("flame")}>
        {pending ? "Creating…" : "Create my shop"}
      </button>
    </form>
  );
}
