import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { formatNaira } from "@/lib/money";
import { Chip, Money, TopBar, Wordmark } from "@/components/ui";
import { TicketPicker } from "@/components/TicketPicker";
import { BasketBar } from "@/components/BasketBar";

interface Props {
  params: Promise<{ slug: string }>;
}

async function loadEvent(slug: string) {
  return db.event.findUnique({
    where: { slug },
    include: {
      ticketTypes: { where: { active: true }, orderBy: { sortOrder: "asc" } },
      organiser: { select: { name: true } },
      connections: {
        where: { status: "ACTIVE" },
        include: {
          shop: {
            include: { _count: { select: { products: { where: { active: true } } } } },
          },
        },
      },
    },
  });
}

/**
 * Real OpenGraph metadata. The PRD calls distribution through WhatsApp and
 * Instagram a strategy pillar — that only works if a shared link unfurls into
 * a proper preview card instead of a blank rectangle.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const event = await loadEvent(slug);
  if (!event) return { title: "Event not found" };

  const cheapest = event.ticketTypes.length
    ? Math.min(...event.ticketTypes.map((t) => t.priceKobo))
    : null;
  const when = event.startsAt.toLocaleDateString("en-NG", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const description =
    event.description?.slice(0, 180) ??
    `${when} at ${event.venue}.${cheapest !== null ? ` Tickets from ${formatNaira(cheapest)}.` : ""}`;

  return {
    title: event.name,
    description,
    openGraph: {
      title: event.name,
      description,
      type: "website",
      url: `/e/${event.slug}`,
      images: event.bannerUrl ? [{ url: event.bannerUrl }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: event.name,
      description,
    },
  };
}

export default async function EventPage({ params }: Props) {
  const { slug } = await params;
  const event = await loadEvent(slug);

  if (!event) notFound();
  if (event.status === "DRAFT") notFound();

  const cancelled = event.status === "CANCELLED";
  const awaitingReview = event.approvalStatus === "PENDING_REVIEW";
  const onSale = event.status === "LIVE" && !awaitingReview && !cancelled;

  const shops = event.connections.map((c) => c.shop);
  const soldOut = event.ticketTypes.every(
    (t) => t.sold + t.reserved >= t.quantity,
  );

  const when = event.startsAt.toLocaleString("en-NG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="pb-28">
      <div className="relative h-44 bg-gradient-to-br from-night via-plum to-flame">
        <div className="absolute left-4 top-3">
          <Wordmark className="!text-white [&>span]:text-marigold" />
        </div>
        <div className="absolute bottom-3 left-4 right-4 text-white">
          <Chip tone={cancelled ? "flame" : awaitingReview ? "line" : "gold"}>
            {cancelled
              ? "Cancelled"
              : awaitingReview
                ? "Under review"
                : event.status === "LIVE"
                  ? "Live"
                  : "Ended"}
          </Chip>
          <h1 className="mt-1 font-display text-[21px] font-extrabold leading-tight">
            {event.name}
          </h1>
        </div>
      </div>

      <div className="px-4 pt-3">
        <dl className="space-y-1 text-[13px] text-[#463D52]">
          <div className="flex items-center gap-2">
            <span aria-hidden>📅</span>
            <span>{when}</span>
          </div>
          <div className="flex items-center gap-2">
            <span aria-hidden>📍</span>
            <span>{event.venue}</span>
          </div>
          <div className="flex items-center gap-2">
            <span aria-hidden>🛡️</span>
            <span>
              By {event.organiser.name ?? "the organiser"} · payments secured by Paystack
            </span>
          </div>
        </dl>

        {event.description && (
          <p className="mt-3 text-[13px] leading-relaxed text-mute">{event.description}</p>
        )}

        {cancelled && (
          <div className="mt-4 rounded-2xl bg-[#FFE7DC] px-4 py-3 text-[13px] text-[#B23A0A]">
            <b>This event has been cancelled.</b> Everyone who bought a ticket or
            placed an order has been refunded automatically.
          </div>
        )}

        {awaitingReview && (
          <div className="mt-4 rounded-2xl bg-[#FFF1D2] px-4 py-3 text-[13px] text-[#8a5f00]">
            <b>Awaiting review.</b> This event isn&apos;t on sale yet — our team is
            checking it over. It usually takes a few hours.
          </div>
        )}

        <h2 className="mt-5 font-display text-[15px] font-bold">Tickets</h2>
        {event.ticketTypes.length === 0 ? (
          <p className="mt-2 text-[13px] text-mute">No tickets on sale yet.</p>
        ) : !onSale ? (
          <div className="mt-2 rounded-2xl border-[1.5px] border-line bg-white px-4 py-4 text-center text-[13px] text-mute">
            {cancelled ? "Sales have closed." : "Not on sale yet."}
          </div>
        ) : soldOut ? (
          <div className="mt-2 rounded-2xl border-[1.5px] border-line bg-white px-4 py-4 text-center text-[13px] text-mute">
            Every ticket is gone. 🎟️
          </div>
        ) : (
          <TicketPicker
            eventSlug={event.slug}
            ticketTypes={event.ticketTypes.map((t) => ({
              id: t.id,
              name: t.name,
              priceKobo: t.priceKobo,
              remaining: Math.max(0, t.quantity - t.sold - t.reserved),
            }))}
          />
        )}

        <div className="mt-6 flex items-center justify-between">
          <h2 className="font-display text-[15px] font-bold">Shops at this event</h2>
          {shops.length > 0 && <Chip tone="leaf">{shops.length} live</Chip>}
        </div>

        {shops.length === 0 ? (
          <p className="mt-2 text-[13px] text-mute">No shops connected yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {shops.map((shop) => (
              <li key={shop.id}>
                <Link
                  href={`/s/${shop.slug}?event=${event.slug}`}
                  className="flex items-center justify-between rounded-2xl border-[1.5px] border-line bg-white px-4 py-3"
                >
                  <span className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-plum text-[12px] font-bold text-white">
                      {shop.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span>
                      <span className="block text-[14px] font-semibold">{shop.name}</span>
                      <span className="block text-[11px] text-mute">
                        {shop._count.products} products ·{" "}
                        {shop.payAtEvent ? "pay at event ok" : "pay online"}
                      </span>
                    </span>
                  </span>
                  <span aria-hidden>›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {event.ticketTypes.length > 0 && !soldOut && onSale && (
          <p className="mt-4 text-[11px] text-mute">
            Tickets from{" "}
            <Money
              kobo={Math.min(...event.ticketTypes.map((t) => t.priceKobo))}
              className="text-[11px]"
            />{" "}
            · no account needed to buy.
          </p>
        )}
      </div>

      <BasketBar eventSlug={event.slug} />
    </div>
  );
}
