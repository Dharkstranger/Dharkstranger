import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { eventMoney } from "@/lib/ledger";
import { eventAccess } from "@/lib/permissions";
import { eventFunnel } from "@/lib/analytics";
import { qrDataUrl } from "@/lib/qr";
import { formatNaira } from "@/lib/money";
import { Chip, Money, Receipt, StatTile, TopBar, btnClass } from "@/components/ui";
import { ConnectionRequest } from "@/components/ConnectionRequest";
import { GuestList } from "@/components/GuestList";
import { CopyLink } from "@/components/CopyLink";

export const metadata = { title: "Event console" };
export const dynamic = "force-dynamic";

export default async function EventConsolePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const { id } = await params;
  const { created } = await searchParams;

  const event = await db.event.findUnique({
    where: { id },
    include: {
      ticketTypes: { orderBy: { sortOrder: "asc" } },
      connections: {
        include: {
          shop: {
            select: {
              id: true,
              name: true,
              slug: true,
              category: true,
              _count: { select: { products: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      members: true,
    },
  });

  if (!event) notFound();

  // The console shows money, so it needs edit access — door staff go to the
  // scanner instead.
  const access = await eventAccess({
    userId: user.id,
    eventId: event.id,
    capability: "editEvent",
  });
  if (!access.allowed) {
    const doorAccess = await eventAccess({
      userId: user.id,
      eventId: event.id,
      capability: "checkIn",
    });
    if (doorAccess.allowed) redirect(`/dashboard/events/${event.id}/scan`);
    notFound();
  }

  const [money, tickets, checkedIn, funnel] = await Promise.all([
    eventMoney(event.id),
    db.ticket.findMany({
      where: { eventId: event.id, status: { in: ["VALID", "CHECKED_IN"] } },
      include: { ticketType: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.ticket.count({ where: { eventId: event.id, status: "CHECKED_IN" } }),
    eventFunnel(event.id),
  ]);

  const base = process.env.APP_URL || "http://localhost:3000";
  const shareUrl = `${base}/e/${event.slug}`;
  const shareQr = await qrDataUrl(shareUrl, 400);

  const pending = event.connections.filter((c) => c.status === "PENDING");
  const active = event.connections.filter((c) => c.status === "ACTIVE");

  const sold = event.ticketTypes.reduce((a, t) => a + t.sold, 0);
  const capacity = event.ticketTypes.reduce((a, t) => a + t.quantity, 0);

  return (
    <div className="pb-16">
      <TopBar title={event.name} backHref="/dashboard" />

      <div className="px-4 pt-4 lg:px-6">
        {created && (
          <div className="mb-4 rounded-2xl border-[1.5px] border-leaf bg-[#E3F0E7] p-4 text-center">
            <div className="text-2xl">🎉</div>
            <div className="font-display text-[16px] font-extrabold">You&apos;re live.</div>
            <p className="text-[12px] text-[#3d5748]">
              This link is your event. Put it everywhere.
            </p>
          </div>
        )}

        <div className="rounded-3xl bg-night p-4 text-white">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[12px] text-[#C9BFD6]">Ticket revenue (net)</div>
              <Money kobo={money.ticketNetKobo} className="text-[24px] text-white" />
            </div>
            <div className="text-right">
              <div className="text-[12px] text-[#C9BFD6]">Your share of shop sales</div>
              <Money kobo={money.organiserShareKobo} className="text-[16px] text-marigold" />
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-[12px] text-[#C9BFD6]">
            <span>
              {checkedIn}/{tickets.length} checked in
            </span>
            <span>Shop GMV {formatNaira(money.shopGrossKobo)}</span>
            <span>
              {sold}/{capacity} tickets sold
            </span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 lg:max-w-md">
          <Link href={`/dashboard/events/${event.id}/scan`} className={btnClass("gold")}>
            Scan tickets
          </Link>
          <Link href={`/dashboard/events/${event.id}/team`} className={btnClass("quiet")}>
            Team{event.members.length > 0 && ` · ${event.members.length}`}
          </Link>
          <Link href={`/dashboard/events/${event.id}/edit`} className={btnClass("quiet")}>
            Edit event
          </Link>
          <Link href={`/e/${event.slug}`} className={btnClass("quiet")}>
            View page
          </Link>
        </div>

        {event.members.filter((m) => m.status === "ACCEPTED" && m.canCheckIn).length ===
          0 && (
          <div className="mt-3 rounded-2xl bg-[#FFF1D2] px-3.5 py-2.5 text-[13px] text-[#8a5f00]">
            <b>You&apos;re the only one who can scan tickets.</b> On the night that
            means one phone on the gate.{" "}
            <Link href={`/dashboard/events/${event.id}/team`} className="underline">
              Add door staff
            </Link>
            .
          </div>
        )}

        {/* Share block — the distribution surface the PRD leans on. */}
        <div className="mt-4 rounded-3xl border-[1.5px] border-line bg-white p-4 text-center lg:max-w-md">
          <div className="mb-2 font-display text-[15px] font-bold">Share your event</div>
          <img
            src={shareQr}
            alt={`QR code linking to ${shareUrl}`}
            width={160}
            height={160}
            className="mx-auto h-40 w-40"
          />
          <CopyLink url={shareUrl} />
        </div>

        {/* Funnel — where the link goes after you share it. */}
        <h2 className="mb-2 mt-6 font-display text-[15px] font-bold">
          How your link is doing
        </h2>
        {funnel.views === 0 ? (
          <p className="text-[13px] text-mute">
            Nobody has opened your event page yet. Share the link and this fills in.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <StatTile label="Opened" sub={`${funnel.uniqueVisitors} people`}>
                {funnel.views}
              </StatTile>
              <StatTile label="Started" sub={`${funnel.viewToCheckoutPct}% of opens`}>
                {funnel.checkoutsStarted}
              </StatTile>
              <StatTile label="Bought" sub={`${funnel.viewToPurchasePct}% of opens`}>
                {funnel.purchases}
              </StatTile>
            </div>
            {funnel.checkoutsStarted > funnel.purchases && (
              <p className="mt-2 text-[13px] text-mute">
                {funnel.checkoutsStarted - funnel.purchases} started checkout and
                didn&apos;t finish
                {funnel.checkoutToPurchasePct > 0 &&
                  ` — ${funnel.checkoutToPurchasePct}% of starters complete`}
                .
              </p>
            )}
          </>
        )}

        {pending.length > 0 && (
          <>
            <h2 className="mb-2 mt-6 font-display text-[15px] font-bold">
              Connection requests
            </h2>
            {pending.map((connection) => (
              <ConnectionRequest
                key={connection.id}
                connectionId={connection.id}
                shopName={connection.shop.name}
                productCount={connection.shop._count.products}
                sharePct={connection.revenueShareBps / 100}
                serviceFeeBps={event.serviceFeeBps}
              />
            ))}
          </>
        )}

        <h2 className="mb-2 mt-6 font-display text-[15px] font-bold">
          Shops · {active.length} live
        </h2>
        {active.length === 0 ? (
          <p className="text-[13px] text-mute">
            No shops connected yet. Vendors request from your event page.
          </p>
        ) : (
          <ul className="space-y-2">
            {active.map((connection) => (
              <li
                key={connection.id}
                className="flex items-center justify-between rounded-2xl border-[1.5px] border-line bg-white px-4 py-3"
              >
                <div>
                  <div className="text-[14px] font-semibold">{connection.shop.name}</div>
                  <div className="text-[12px] text-mute">
                    {connection.shop._count.products} products
                  </div>
                </div>
                <Chip tone="leaf">{connection.revenueShareBps / 100}% to you</Chip>
              </li>
            ))}
          </ul>
        )}

        <h2 className="mb-2 mt-6 font-display text-[15px] font-bold">
          Guests · {checkedIn}/{tickets.length} in
        </h2>
        <GuestList
          eventId={event.id}
          guests={tickets.map((t) => ({
            id: t.id,
            name: t.attendeeName,
            email: t.attendeeEmail,
            code: t.code,
            ticketTypeName: t.ticketType.name,
            checkedIn: t.status === "CHECKED_IN",
          }))}
        />
      </div>
    </div>
  );
}
