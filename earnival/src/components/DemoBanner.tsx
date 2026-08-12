/**
 * Demo-environment banner.
 *
 * Renders on every page when `NEXT_PUBLIC_DEMO_MODE=1`. A shared link drops
 * people straight onto an event page, so a notice that lives only on the
 * landing page is a notice most visitors never see — and someone who believes
 * they have bought a ticket on a demo has been misled by us, not by their own
 * carelessness.
 *
 * Unset the variable and this disappears entirely, so the real deployment
 * never carries it.
 */
export function DemoBanner() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "1") return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-50 bg-night px-4 py-2 text-center text-[12px] leading-snug text-white"
    >
      <b className="text-flame">Demo</b> — payments are simulated and no real
      money moves. Please don&apos;t enter real card or ID details.
    </div>
  );
}
