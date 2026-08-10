import { notFound, redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { eventAccess } from "@/lib/permissions";
import { TopBar } from "@/components/ui";
import { EditEventForm } from "@/components/EditEventForm";
import { TicketTypeEditor } from "@/components/TicketTypeEditor";

export const metadata = { title: "Edit event" };
export const dynamic = "force-dynamic";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const { id } = await params;
  const access = await eventAccess({
    userId: user.id,
    eventId: id,
    capability: "editEvent",
  });
  if (!access.allowed) notFound();

  const event = await db.event.findUniqueOrThrow({
    where: { id },
    include: { ticketTypes: { orderBy: { sortOrder: "asc" } } },
  });

  const ticketHolders = await db.ticket.count({
    where: { eventId: id, status: { in: ["VALID", "CHECKED_IN"] } },
  });

  return (
    <div className="pb-16">
      <TopBar title="Edit event" backHref={`/dashboard/events/${event.id}`} />

      <div className="px-4 pt-4 lg:px-6">
        <EditEventForm
          event={{
            id: event.id,
            name: event.name,
            venue: event.venue,
            description: event.description,
            organiserNote: event.organiserNote,
            bannerUrl: event.bannerUrl,
            // Split for the date and time inputs, in local time.
            date: event.startsAt.toISOString().slice(0, 10),
            time: event.startsAt.toTimeString().slice(0, 5),
          }}
          ticketHolders={ticketHolders}
        />

        <h2 className="mb-2 mt-8 font-display text-[15px] font-bold">Ticket types</h2>
        <p className="mb-3 text-[13px] text-mute">
          Repricing applies to future sales only — tickets already bought keep the
          price they were paid at.
        </p>

        <TicketTypeEditor
          eventId={event.id}
          ticketTypes={event.ticketTypes.map((t) => ({
            id: t.id,
            name: t.name,
            priceNaira: t.priceKobo / 100,
            quantity: t.quantity,
            sold: t.sold,
            reserved: t.reserved,
            active: t.active,
          }))}
        />
      </div>
    </div>
  );
}
