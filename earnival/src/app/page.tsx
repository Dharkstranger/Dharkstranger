import Link from "next/link";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Chip, Money, Wordmark, btnClass } from "@/components/ui";
import { isSandbox } from "@/lib/paystack";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [events, user] = await Promise.all([
    db.event.findMany({
      where: { status: "LIVE", visibility: "PUBLIC" },
      orderBy: { startsAt: "asc" },
      take: 20,
      include: {
        ticketTypes: { where: { active: true }, select: { priceKobo: true } },
        _count: { select: { connections: { where: { status: "ACTIVE" } } } },
      },
    }),
    getCurrentUser(),
  ]);

  return (
    <div className="pb-10">
      <header className="flex items-center justify-between border-b border-line bg-paper px-4 py-3">
        <Wordmark />
        <Link
          href={user ? "/dashboard" : "/signin"}
          className="rounded-full bg-haze px-3 py-1.5 text-[12px] font-semibold"
        >
          {user ? "Console" : "Sign in"}
        </Link>
      </header>

      <div className="px-4 pt-5">
        <h1 className="font-display text-[27px] font-extrabold leading-tight">
          The market comes
          <br />
          alive at <span className="text-flame">events</span>.
        </h1>
        <p className="mt-1 text-[13px] text-mute">
          Buy tickets. Shop the vendors. Cashless, pickup at the event.
        </p>

        {isSandbox() && (
          <div className="mt-4 rounded-2xl bg-[#FFF1D2] px-3.5 py-2.5 text-[11.5px] text-[#8a5f00]">
            <b>Sandbox mode</b> — payments are simulated. Add{" "}
            <code className="font-mono">PAYSTACK_SECRET_KEY</code> to go live.
          </div>
        )}

        <div className="mb-2 mt-5 flex items-center justify-between">
          <h2 className="font-display text-[15px] font-bold">Happening now</h2>
          {events.length > 0 && <Chip tone="flame">● {events.length} live</Chip>}
        </div>

        {events.length === 0 ? (
          <div className="rounded-3xl border-[1.5px] border-dashed border-line px-6 py-12 text-center">
            <div className="mb-2 text-3xl">🎪</div>
            <div className="font-display text-[16px] font-bold">Nothing live yet</div>
            <p className="mx-auto mb-4 mt-1 max-w-[260px] text-[13px] text-mute">
              Be the one who starts the party.
            </p>
            <Link
              href="/dashboard/events/new"
              className={btnClass("flame", { full: false })}
            >
              Create an event
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {events.map((event) => {
              const cheapest = event.ticketTypes.length
                ? Math.min(...event.ticketTypes.map((t) => t.priceKobo))
                : null;
              return (
                <li key={event.id}>
                  <Link
                    href={`/e/${event.slug}`}
                    className="block overflow-hidden rounded-3xl border-[1.5px] border-line bg-white"
                  >
                    <div className="relative h-28 bg-gradient-to-br from-night via-plum to-flame">
                      {event._count.connections > 0 && (
                        <div className="absolute right-3 top-3">
                          <Chip tone="gold">
                            {event._count.connections} shop
                            {event._count.connections > 1 ? "s" : ""} live
                          </Chip>
                        </div>
                      )}
                      <div className="absolute bottom-2.5 left-4 right-4">
                        <div className="font-display text-[16px] font-extrabold leading-tight text-white">
                          {event.name}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="text-[12px] text-mute">
                        <div>
                          📅{" "}
                          {event.startsAt.toLocaleDateString("en-NG", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                        <div className="mt-0.5">📍 {event.venue.split(",")[0]}</div>
                      </div>
                      {cheapest !== null && (
                        <div className="text-right">
                          <div className="text-[10px] uppercase text-mute">From</div>
                          <Money kobo={cheapest} className="text-[15px]" />
                        </div>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-5 flex items-center justify-between gap-3 rounded-3xl bg-night p-4">
          <div>
            <div className="font-display text-[15px] font-bold text-white">
              Throwing something?
            </div>
            <div className="text-[12px] text-[#C9BFD6]">
              Live event + shareable link in minutes.
            </div>
          </div>
          <Link
            href="/dashboard/events/new"
            className={btnClass("flame", { full: false, small: true })}
          >
            Create
          </Link>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 rounded-3xl bg-haze p-4">
          <div>
            <div className="font-display text-[15px] font-bold">Selling at events?</div>
            <div className="text-[12px] text-mute">
              A shop that outlives every event.
            </div>
          </div>
          <Link href="/shop" className={btnClass("ghost", { full: false, small: true })}>
            Open a shop
          </Link>
        </div>
      </div>
    </div>
  );
}
