import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { unsettledBalance } from "@/lib/ledger";
import { Chip, Money, StatTile, TopBar, btnClass } from "@/components/ui";
import { SignOutButton } from "@/components/SignOutButton";

export const metadata = { title: "Organiser console" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?next=/dashboard");

  const [events, balance, shop] = await Promise.all([
    db.event.findMany({
      where: { organiserId: user.id },
      orderBy: { startsAt: "desc" },
      include: {
        _count: {
          select: {
            tickets: { where: { status: { in: ["VALID", "CHECKED_IN"] } } },
            connections: { where: { status: "PENDING" } },
          },
        },
      },
    }),
    unsettledBalance(user.id),
    db.shop.findFirst({ where: { ownerId: user.id }, select: { slug: true } }),
  ]);

  return (
    <div className="pb-16">
      <TopBar title="Organiser console" right={<SignOutButton />} />

      <div className="px-4 pt-4">
        <div className="rounded-3xl bg-night p-4 text-white">
          <div className="text-[11px] text-[#C9BFD6]">Awaiting settlement</div>
          <Money kobo={balance} className="text-[26px] text-white" />
          <div className="mt-1 text-[11px] text-[#C9BFD6]">
            Pays out T+1 after the settlement trigger.
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link href="/dashboard/events/new" className={btnClass("flame")}>
            New event
          </Link>
          <Link href={shop ? "/shop" : "/shop"} className={btnClass("quiet")}>
            {shop ? "My shop" : "Open a shop"}
          </Link>
        </div>

        <h2 className="mb-2 mt-6 font-display text-[15px] font-bold">Your events</h2>

        {events.length === 0 ? (
          <div className="rounded-3xl border-[1.5px] border-dashed border-line px-6 py-12 text-center">
            <div className="mb-2 text-3xl">🎪</div>
            <div className="font-display text-[16px] font-bold">No events yet</div>
            <p className="mx-auto mb-4 mt-1 max-w-[240px] text-[13px] text-mute">
              Create one and you get a shareable link instantly.
            </p>
            <Link
              href="/dashboard/events/new"
              className={btnClass("flame", { full: false })}
            >
              Create event
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {events.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/dashboard/events/${event.id}`}
                  className="relative block rounded-3xl bg-night p-4 text-white"
                >
                  <div className="text-[10px] uppercase tracking-[0.2em] text-marigold">
                    {event.status.toLowerCase()}
                  </div>
                  <div className="mt-0.5 pr-20 font-display text-[16px] font-extrabold leading-tight">
                    {event.name}
                  </div>
                  <div className="mt-2 flex gap-4 text-[12px] text-[#C9BFD6]">
                    <span>👥 {event._count.tickets}</span>
                    <span>
                      📅{" "}
                      {event.startsAt.toLocaleDateString("en-NG", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                  {event._count.connections > 0 && (
                    <span className="absolute right-3 top-3">
                      <Chip tone="flame">
                        {event._count.connections} request
                        {event._count.connections > 1 ? "s" : ""}
                      </Chip>
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
