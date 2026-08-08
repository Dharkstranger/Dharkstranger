import { notFound, redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
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
  const event = await db.event.findUnique({
    where: { id },
    select: { id: true, name: true, organiserId: true },
  });

  if (!event || event.organiserId !== user.id) notFound();

  return (
    <div>
      <TopBar title="Scan tickets" backHref={`/dashboard/events/${event.id}`} />
      <Scanner eventId={event.id} eventName={event.name} />
    </div>
  );
}
