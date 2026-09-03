import Link from "next/link";
import type { ReactNode } from "react";
import { formatNaira } from "@/lib/money";

/* ---------------- primitives ---------------- */

export function Money({
  kobo,
  className = "",
}: {
  kobo: number;
  className?: string;
}) {
  return (
    <span className={`font-mono font-bold tabular-nums ${className}`}>
      {formatNaira(kobo)}
    </span>
  );
}

const CHIP_TONES = {
  night: "bg-night text-white",
  flame: "bg-[#FFE7DC] text-[#B23A0A]",
  gold: "bg-[#FFF1D2] text-[#8a5f00]",
  plum: "bg-[#EEE6F9] text-plum",
  leaf: "bg-[#E3F0E7] text-leaf",
  line: "bg-[#F1EBDF] text-mute",
} as const;

export function Chip({
  children,
  tone = "night",
}: {
  children: ReactNode;
  tone?: keyof typeof CHIP_TONES;
}) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-[3px] text-[11px] font-bold uppercase tracking-wide ${CHIP_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

const BTN_VARIANTS = {
  primary: "bg-night text-white",
  flame: "bg-flame text-white",
  gold: "bg-marigold text-night",
  ghost: "bg-transparent text-night border-[1.5px] border-night",
  quiet: "bg-haze text-night",
} as const;

export function btnClass(
  variant: keyof typeof BTN_VARIANTS = "primary",
  opts: { full?: boolean; small?: boolean } = {},
): string {
  const { full = true, small = false } = opts;
  return [
    "inline-flex items-center justify-center gap-1.5 rounded-2xl font-semibold transition",
    "active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none",
    small ? "px-3 py-2 text-[13px]" : "px-4 py-3.5 text-[15px]",
    full ? "w-full" : "",
    BTN_VARIANTS[variant],
  ].join(" ");
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
  full = true,
  small = false,
}: {
  href: string;
  children: ReactNode;
  variant?: keyof typeof BTN_VARIANTS;
  full?: boolean;
  small?: boolean;
}) {
  return (
    <Link href={href} className={btnClass(variant, { full, small })}>
      {children}
    </Link>
  );
}

/* ---------------- layout ---------------- */

export function TopBar({
  title,
  backHref,
  right,
}: {
  title?: string;
  backHref?: string;
  right?: ReactNode;
}) {
  return (
    <div className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-paper px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        {backHref && (
          <Link
            href={backHref}
            aria-label="Go back"
            className="-ml-1.5 shrink-0 rounded-full p-1.5 hover:bg-haze"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M15 18l-6-6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        )}
        {title ? (
          <span className="truncate font-display text-[16px] font-bold">{title}</span>
        ) : (
          <Wordmark />
        )}
      </div>
      {right}
    </div>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`font-display text-[20px] font-extrabold text-night ${className}`}
    >
      earn<span className="text-flame">i</span>val
    </Link>
  );
}

export function Empty({
  title,
  body,
  cta,
  ctaHref,
}: {
  title: string;
  body: string;
  cta?: string;
  ctaHref?: string;
}) {
  return (
    <div className="px-6 py-14 text-center">
      <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-haze text-2xl">
        ✨
      </div>
      <div className="font-display text-[16px] font-bold">{title}</div>
      <p className="mx-auto mb-4 mt-1 max-w-[260px] text-[13px] text-mute">{body}</p>
      {cta && ctaHref && (
        <ButtonLink href={ctaHref} variant="flame" full={false}>
          {cta}
        </ButtonLink>
      )}
    </div>
  );
}

export function Callout({
  tone = "gold",
  children,
}: {
  tone?: "gold" | "plum" | "flame";
  children: ReactNode;
}) {
  const tones = {
    gold: "bg-[#FFF1D2] text-[#8a5f00]",
    plum: "bg-[#EEE6F9] text-plum",
    flame: "bg-[#FFE7DC] text-[#B23A0A]",
  };
  return (
    <div className={`rounded-2xl px-3.5 py-2.5 text-[12px] ${tones[tone]}`}>{children}</div>
  );
}

/* ---------------- settlement receipt ---------------- */

export interface ReceiptLine {
  label: string;
  kobo: number;
  strong?: boolean;
}

/**
 * The settlement breakdown. Every party sees exactly where the money went —
 * PRD CON-05's "no blind accepts" applied to payouts as well as connections.
 */
export function Receipt({
  title,
  lines,
  total,
}: {
  title: string;
  lines: ReceiptLine[];
  total: { label: string; kobo: number };
}) {
  return (
    <div className="my-3">
      <div className="rounded-t-2xl bg-night px-4 pb-2 pt-3 text-white">
        <div className="text-[11px] uppercase tracking-[0.2em] text-marigold">
          Settlement split
        </div>
        <div className="text-sm font-semibold">{title}</div>
      </div>
      <div className="border-x border-line bg-white px-4 py-2">
        {lines.map((line, i) => (
          <div
            key={line.label}
            className="flex items-baseline justify-between py-[6px] text-[13px]"
            style={{
              borderBottom: i < lines.length - 1 ? "1px dashed #E9E2D6" : "none",
            }}
          >
            <span className={line.strong ? "font-semibold text-night" : "text-mute"}>
              {line.label}
            </span>
            <Money kobo={line.kobo} className={line.strong ? "" : "font-normal"} />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-x border-b border-t-2 border-line border-t-night bg-white px-4 py-3">
        <span className="text-[12px] font-bold uppercase tracking-wide text-leaf">
          {total.label}
        </span>
        <Money kobo={total.kobo} className="text-[16px] text-leaf" />
      </div>
    </div>
  );
}

/* ---------------- misc ---------------- */

export function StatTile({
  label,
  children,
  sub,
}: {
  label: string;
  children: ReactNode;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border-[1.5px] border-line bg-white px-3.5 py-3">
      <div className="text-[11px] uppercase tracking-wider text-mute">{label}</div>
      <div className="mt-0.5 font-display text-[18px] font-extrabold">{children}</div>
      {sub && <div className="text-[12px] text-mute">{sub}</div>}
    </div>
  );
}

export function EventBanner({
  name,
  className = "",
  children,
}: {
  name: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={`relative bg-gradient-to-br from-night via-plum to-flame ${className}`}
      role="img"
      aria-label={`Banner for ${name}`}
    >
      {children}
    </div>
  );
}
