import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { qrDataUrl, ticketUrl, verifyTicketToken } from "@/lib/qr";
import { Chip, TopBar } from "@/components/ui";

export const metadata = {
  title: "Your ticket",
  // A badge is a bearer credential — keep it out of search indexes.
  robots: { index: false, follow: false },
};

export default async function TicketPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Signature is checked before any database lookup, so a forged or edited
  // token never reaches the query.
  const ticketId = verifyTicketToken(token);
  if (!ticketId) notFound();

  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
    include: { event: true, ticketType: true },
  });
  if (!ticket || ticket.qrToken !== token) notFound();

  const qr = await qrDataUrl(ticketUrl(ticket.qrToken), 480);

  const when = ticket.event.startsAt.toLocaleString("en-NG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

  const unpaid = ticket.status === "PENDING_PAYMENT";
  const dead = ticket.status === "CANCELLED" || ticket.status === "REFUNDED";

  return (
    <div>
      <TopBar title="Event badge" backHref={`/e/${ticket.event.slug}`} />

      <div className="px-4 pb-16 pt-4">
        {unpaid && (
          <div className="mb-3 rounded-2xl bg-[#FFF1D2] px-3.5 py-2.5 text-[12px] text-[#8a5f00]">
            This ticket is still awaiting payment and won&apos;t scan at the gate.
          </div>
        )}
        {dead && (
          <div className="mb-3 rounded-2xl bg-[#FFE7DC] px-3.5 py-2.5 text-[12px] text-[#B23A0A]">
            This ticket has been {ticket.status.toLowerCase()}.
          </div>
        )}

        <div className="overflow-hidden rounded-3xl border-[1.5px] border-marigold bg-white">
          <div className="bg-gradient-to-br from-night via-plum to-flame px-5 py-4 text-white">
            <div className="text-[11px] uppercase tracking-[0.2em] text-marigold">
              Event badge
            </div>
            <div className="mt-0.5 font-display text-[18px] font-extrabold leading-tight">
              {ticket.event.name}
            </div>
            <div className="mt-1 text-[12px] text-white/80">{when}</div>
            <div className="text-[12px] text-white/80">{ticket.event.venue}</div>
          </div>

          <div className="px-5 py-5 text-center">
            {/* A genuine QR encoding this badge's signed URL — any camera reads it. */}
            <img
              src={qr}
              alt={`QR code for ticket ${ticket.code}`}
              width={240}
              height={240}
              className="mx-auto h-60 w-60"
            />

            <div className="mt-4 text-[12px] uppercase tracking-wider text-mute">
              Check-in code
            </div>
            <div className="font-mono text-[26px] font-bold tracking-[0.2em]">
              {ticket.code}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
              <Chip tone="plum">{ticket.ticketType.name}</Chip>
              {ticket.status === "VALID" && <Chip tone="leaf">Valid</Chip>}
              {ticket.status === "CHECKED_IN" && <Chip tone="night">Checked in</Chip>}
              {unpaid && <Chip tone="gold">Unpaid</Chip>}
            </div>

            <div className="mt-4 border-t border-dashed border-line pt-3 text-[13px]">
              <div className="font-semibold">{ticket.attendeeName}</div>
              <div className="text-[12px] text-mute">{ticket.attendeeEmail}</div>
            </div>
          </div>
        </div>

        {ticket.event.organiserNote && (
          <div className="mt-4 rounded-2xl bg-haze p-4 text-[13px]">
            <div className="mb-1 font-display font-bold">From the organiser</div>
            <p className="text-mute">{ticket.event.organiserNote}</p>
          </div>
        )}

        <p className="mt-4 text-center text-[12px] text-mute">
          Screenshot this or keep the link — it&apos;s your entry.
        </p>
      </div>
    </div>
  );
}
