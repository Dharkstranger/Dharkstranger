"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { addProductAction, type ActionState } from "@/app/actions";
import { ImageUpload } from "./ImageUpload";
import { btnClass } from "./ui";

export function ProductForm({ shopId }: { shopId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    addProductAction,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);
  // Remounts the uploader after a successful add; form.reset() cannot clear
  // component state holding the uploaded URL.
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setFormKey((k) => k + 1);
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-2xl border-[1.5px] border-dashed border-line bg-white p-3.5"
    >
      <input type="hidden" name="shopId" value={shopId} />

      <ImageUpload
        key={formKey}
        name="imageUrl"
        label="Product photo (optional)"
        hint="Photos sell. An emoji is the fallback."
        aspect="square"
        maxEdge={800}
      />

      <div className="grid grid-cols-6 gap-2">
        <input
          name="emoji"
          placeholder="🍢"
          aria-label="Emoji"
          maxLength={4}
          className="rounded-xl border-[1.5px] border-line px-2 py-2 text-center text-[15px] outline-none"
        />
        <input
          required
          name="name"
          placeholder="Product name"
          aria-label="Product name"
          className="col-span-3 rounded-xl border-[1.5px] border-line px-3 py-2 text-[13px] outline-none"
        />
        <input
          required
          name="price"
          inputMode="numeric"
          placeholder="₦"
          aria-label="Price in naira"
          className="rounded-xl border-[1.5px] border-line px-2 py-2 font-mono text-[13px] outline-none"
        />
        <input
          required
          name="stock"
          inputMode="numeric"
          placeholder="Qty"
          aria-label="Stock quantity"
          className="rounded-xl border-[1.5px] border-line px-2 py-2 font-mono text-[13px] outline-none"
        />
      </div>

      {state.error && (
        <p role="alert" className="mt-2 text-[12px] font-medium text-[#B23A0A]">
          {state.error}
        </p>
      )}

      <div className="mt-2">
        <button
          type="submit"
          disabled={pending}
          className={btnClass("quiet", { small: true })}
        >
          {pending ? "Adding…" : "+ Add product"}
        </button>
      </div>
    </form>
  );
}
