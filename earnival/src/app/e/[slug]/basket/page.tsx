import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { TopBar } from "@/components/ui";
import { BasketView } from "@/components/BasketView";

export const metadata = { title: "Your basket" };

export default async function BasketPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await db.event.findUnique({
    where: { slug },
    select: {
      slug: true,
      name: true,
      status: true,
      processingFeeBps: true,
      connections: {
        where: { status: "ACTIVE" },
        select: { shop: { select: { id: true, name: true, payAtEvent: true } } },
      },
    },
  });

  if (!event || event.status !== "LIVE") notFound();

  return (
    <div>
      <TopBar title="Your basket" backHref={`/e/${event.slug}`} />
      <BasketView
        eventSlug={event.slug}
        processingFeeBps={event.processingFeeBps}
        shops={event.connections.map((c) => c.shop)}
      />
    </div>
  );
}
