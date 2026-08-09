import Link from "next/link";

import { db } from "@/lib/db";
import { verifyLookupToken } from "@/lib/lookup";
import { Chip, Money, TopBar, btnClass } from "@/components/ui";

export const metadata = {
  title: "Your tickets and orders",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function LookupResultsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const email = verifyLookupToken(token);

  if (!email) {
    return (
      <div>
        <TopBar title="Link expired" backHref="/find" />
        <div className="px-4 py-14 text-center">
          <div className="text-3xl" aria-hidden>
            ⌛
          </div>
          <h1 className="mt-2 font-display text-[18px] font-extrabold">
            That link has expired
          </h1>
          <p className="mx-auto mb-5 mt-1 max-w-[280px] text-[13px] text-mute">
            Lookup links last 30 minutes for your security. Request a fresh one.
          </p>
          <Link href="/find" className={btnClass("flame", { full: false })}>
            Get a new link
          </Link>
        </div>
      </div>
    );
  }

  const [tickets, orders] = await Promise.all([
    db.ticket.findMany({
      where: { attendeeEmail: email, status: { in: ["VALID", "CHECKED_IN"] } },
      include: {
        event: { select: { name: true, slug: true, venue: true, startsAt: true } },
        ticketType: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.order.findMany({
      where: { buyerEmail: email },
      include: { shop: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div>
      <TopBar title="Your tickets" backHref="/" />
      <div className="px-4 pb-16 pt-4">
        <p className="mb-4 text-[13px] text-mute">
          Everything bought with <b className="text-night">{email}</b>.
        </p>

        <h2 className="mb-2 font-display text-[15px] font-bold">
          Tickets {tickets.length > 0 && `· ${tickets.length}`}
        </h2>

        {tickets.length === 0 ? (
          <p className="mb-6 text-[13px] text-mute">No tickets on this address.</p>
        ) : (
          <ul className="mb-6 space-y-2">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={`/t/${ticket.qrToken}`}
                  className="flex items-center justify-between rounded-2xl border-[1.5px] border-marigold bg-white px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold">
                      {ticket.event.name}
                    </span>
                    <span className="block text-[12px] text-mute">
                      {ticket.event.startsAt.toLocaleDateString("en-NG", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}{" "}
                      · {ticket.ticketType.name} ·{" "}
                      <span className="font-mono">{ticket.code}</span>
                    </span>
                  </span>
                  <span className="shrink-0 pl-3">
                    {ticket.status === "CHECKED_IN" ? (
                      <Chip tone="night">Used</Chip>
                    ) : (
                      <span className="text-[13px] font-semibold text-plum">
                        View QR →
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <h2 className="mb-2 font-display text-[15px] font-bold">
          Orders {orders.length > 0 && `· ${orders.length}`}
        </h2>

        {orders.length === 0 ? (
          <p className="text-[13px] text-mute">No shop orders on this address.</p>
        ) : (
          <ul className="space-y-2">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/orders/${order.reference}`}
                  className="flex items-center justify-between rounded-2xl border-[1.5px] border-line bg-white px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="block font-mono text-[13px] font-semibold">
                      {order.reference}
                    </span>
                    <span className="block truncate text-[12px] text-mute">
                      {order.shop.name} · <Money kobo={order.totalKobo} className="text-[12px]" />
                    </span>
                  </span>
                  <Chip
                    tone={
                      order.status === "COMPLETED"
                        ? "leaf"
                        : order.status === "READY"
                          ? "gold"
                          : "line"
                    }
                  >
                    {order.status.toLowerCase().replace(/_/g, " ")}
                  </Chip>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-8 text-center text-[12px] text-mute">
          Want these to stay in one place?{" "}
          <Link href="/signin" className="font-semibold text-plum underline">
            Create an account
          </Link>{" "}
          with this email and they&apos;ll attach automatically.
        </p>
      </div>
    </div>
  );
}
