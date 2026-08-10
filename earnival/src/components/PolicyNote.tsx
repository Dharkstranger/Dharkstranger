import Link from "next/link";

/**
 * Shown wherever someone is about to pay. The refund rules were decided but
 * never surfaced to buyers, which is exactly how a resolved policy turns into
 * a dispute.
 */
export function PolicyNote({ context }: { context: "ticket" | "order" }) {
  return (
    <div className="mt-3 rounded-2xl bg-haze px-3.5 py-3 text-[12px] leading-relaxed text-[#463D52]">
      <p className="font-semibold">If something goes wrong, you get your money back.</p>
      <p className="mt-1">
        {context === "ticket"
          ? "If the event is cancelled you're refunded automatically — including the processing fee. Once your ticket has been scanned at the gate it can't be refunded."
          : "The vendor can refund you any time before you collect. You get back what you paid, including the processing fee. Once collected, it can't be refunded in-app."}
      </p>
      <p className="mt-2 text-mute">
        By paying you agree to our{" "}
        <Link href="/terms" className="font-semibold text-plum underline">
          terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="font-semibold text-plum underline">
          privacy policy
        </Link>
        .
      </p>
    </div>
  );
}
