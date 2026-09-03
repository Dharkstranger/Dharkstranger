import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { Chip, Money, TopBar } from "@/components/ui";
import { AddToCart } from "@/components/AddToCart";
import { BasketBar } from "@/components/BasketBar";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ event?: string }>;
}

async function loadShop(slug: string) {
  return db.shop.findUnique({
    where: { slug },
    include: {
      products: { where: { active: true }, orderBy: { createdAt: "asc" } },
      connections: {
        where: { status: "ACTIVE" },
        include: { event: { select: { slug: true, name: true, status: true } } },
      },
    },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const shop = await loadShop(slug);
  if (!shop) return { title: "Shop not found" };

  const description =
    shop.description ?? `${shop.category} — shop ${shop.name} at events on Earnival.`;

  return {
    title: shop.name,
    description,
    openGraph: { title: shop.name, description, url: `/s/${shop.slug}` },
  };
}

export default async function ShopPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { event: eventSlug } = await searchParams;
  const shop = await loadShop(slug);

  if (!shop || shop.status === "DRAFT") notFound();

  const liveConnections = shop.connections.filter((c) => c.event.status === "LIVE");
  // Buying requires an event context: a shop is only purchasable through an
  // event it is connected to (PRD CON-06).
  const activeEvent =
    liveConnections.find((c) => c.event.slug === eventSlug)?.event ??
    (liveConnections.length === 1 ? liveConnections[0].event : null);

  return (
    <div className="pb-28">
      <TopBar
        title={shop.name}
        backHref={activeEvent ? `/e/${activeEvent.slug}` : "/"}
      />

      <div className="px-4 pt-3">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {shop.status === "ACTIVE" ? (
            <Chip tone="leaf">Open</Chip>
          ) : (
            <Chip tone="line">Closed</Chip>
          )}
          {shop.payAtEvent && <Chip tone="gold">Pay at event ok</Chip>}
          <Chip tone="line">{shop.category}</Chip>
        </div>

        {shop.description && (
          <p className="mb-4 text-[13px] text-mute">{shop.description}</p>
        )}

        {!activeEvent && (
          <div className="mb-4 rounded-2xl bg-[#FFF1D2] px-3.5 py-2.5 text-[12px] text-[#8a5f00]">
            {liveConnections.length === 0 ? (
              <>
                This shop isn&apos;t connected to a live event yet, so its products
                can&apos;t be bought right now.
              </>
            ) : (
              <>Open this shop from an event page to order.</>
            )}
          </div>
        )}

        {shop.products.length === 0 ? (
          <p className="text-[13px] text-mute">No products listed yet.</p>
        ) : (
          <ul className="space-y-2">
            {shop.products.map((product) => {
              const available = Math.max(0, product.stock - product.reserved);
              return (
                <li
                  key={product.id}
                  className="flex items-center justify-between rounded-2xl border-[1.5px] border-line bg-white px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.imageUrl}
                        alt=""
                        loading="lazy"
                        className="h-14 w-14 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-haze text-2xl">
                        {product.emoji ?? "🛍️"}
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-semibold">
                        {product.name}
                      </div>
                      <div
                        className={`text-[12px] ${
                          available <= 5 ? "text-[#B23A0A]" : "text-mute"
                        }`}
                      >
                        {available > 0 ? `${available} left` : "Sold out"}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Money kobo={product.priceKobo} className="text-[14px]" />
                    {activeEvent && (
                      <AddToCart
                        eventSlug={activeEvent.slug}
                        product={{
                          productId: product.id,
                          shopId: shop.id,
                          shopSlug: shop.slug,
                          shopName: shop.name,
                          name: product.name,
                          priceKobo: product.priceKobo,
                          emoji: product.emoji,
                          maxQuantity: available,
                        }}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {liveConnections.length > 0 && (
          <>
            <h2 className="mb-2 mt-6 font-display text-[15px] font-bold">
              Selling at
            </h2>
            <ul className="space-y-1 text-[13px]">
              {liveConnections.map((c) => (
                <li key={c.id}>
                  <a
                    href={`/e/${c.event.slug}`}
                    className="text-plum underline underline-offset-2"
                  >
                    {c.event.name}
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {activeEvent && <BasketBar eventSlug={activeEvent.slug} />}
    </div>
  );
}
