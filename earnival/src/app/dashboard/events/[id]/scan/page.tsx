import { notFound, redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { eventAccess } from "@/lib/permissions";
import { TopBar } from "@/components/ui";
import { Scanner } from "@/components/Scanner";

export const metadata = { title: "Scan tickets" };

export default async function ScanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const { id } = await params;

  // Door staff can scan without being able to see the money.
  const access = await eventAccess({
    userId: user.id,
    eventId: id,
    capability: "checkIn",
  });
  if (!access.allowed) notFound();

  const event = await db.event.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!event) notFound();

  const [checkedInCount, totalCount] = await Promise.all([
    db.ticket.count({ where: { eventId: event.id, status: "CHECKED_IN" } }),
    db.ticket.count({
      where: { eventId: event.id, status: { in: ["VALID", "CHECKED_IN"] } },
    }),
  ]);

  return (
    <div>
      <TopBar
        title="Scan tickets"
        backHref={access.isOwner ? `/dashboard/events/${event.id}` : "/dashboard"}
      />
      
        <Scanner
          eventId={event.id}
          eventName={event.name}
          checkedInCount={checkedInCount}
          totalCount={totalCount}
        />
      
    </div>
  );
}
