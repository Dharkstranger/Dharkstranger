import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { TopBar } from "@/components/ui";
import { EventForm } from "@/components/EventForm";

export const metadata = { title: "Create event" };

export default async function NewEventPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?next=/dashboard/events/new");

  return (
    <div>
      <TopBar title="Create event" backHref="/dashboard" />
      <EventForm />
    </div>
  );
}
