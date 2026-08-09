import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { shopMoney, unsettledBalance } from "@/lib/ledger";
import { splitSale } from "@/lib/money";
import { Chip, Money, Receipt, TopBar } from "@/components/ui";
import { SignOutButton } from "@/components/SignOutButton";
import { ShopForm } from "@/components/ShopForm";
import { ProductForm } from "@/components/ProductForm";
import { ConnectForm } from "@/components/ConnectForm";
import { OrderCard } from "@/components/OrderCard";
import { CopyLink } from "@/components/CopyLink";

export const metadata = { title: "Your shop" };
export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?next=/shop");

  const shop = await db.shop.findFirst({
    where: { ownerId: user.id },
    include: {
      products: { orderBy: { createdAt: "asc" } },
      connections: {
        include: { event: { select: { id: true, name: true, slug: true, status: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!shop) {
    return (
      <div>
        <TopBar title="Your shop" right={<SignOutButton />} />
        <div className="px-4 pb-24 pt-4">
          <div className="mb-4 rounded-3xl bg-haze p-4">
            <div className="font-display text-[15px] font-bold">
              A shop that outlives every event.
            </div>
            <p className="mt-1 text-[12px] text-mute">
              Permanent storefront · its own link and QR · connect to any event ·
              settle T+1.
            </p>
          </div>
          <ShopForm />
        </div>
      </div>
    );
  }

  const [money, balance, orders, connectableEvents] = await Promise.all([
    shopMoney(shop.id),
    unsettledBalance(user.id),
    db.order.findMany({
      where: { shopId: shop.id, status: { not: "CANCELLED" } },
      include: { items: true, event: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.event.findMany({
      where: {
        status: "LIVE",
        connections: { none: { shopId: shop.id } },
      },
      select: { id: true, name: true, slug: true },
      take: 10,
    }),
  ]);

  const activeConnection = shop.connections.find((c) => c.status === "ACTIVE");
  const exampleSplit = splitSale({
    grossKobo: money.grossKobo || 0,
    serviceFeeBps: 750,
    revenueShareBps: activeConnection?.revenueShareBps ?? 0,
  });

  const base = process.env.APP_URL || "http://localhost:3000";
  const openOrders = orders.filter((o) => o.status !== "COMPLETED");

  return (
    <div className="pb-16">
      <TopBar title={shop.name} right={<SignOutButton />} />

      <div className="px-4 pt-4 lg:px-6">
        <div className="rounded-3xl bg-night p-4 text-white lg:max-w-md">
          <div className="text-[12px] text-[#C9BFD6]">Gross sales</div>
          <Money kobo={money.grossKobo} className="text-[26px] text-white" />
          <div className="mt-2 flex justify-between text-[12px] text-[#C9BFD6]">
            <span>Awaiting settlement</span>
            <Money kobo={balance} className="text-[13px] text-marigold" />
          </div>
        </div>

        {shop.status === "DRAFT" && (
          <div className="mt-3 rounded-2xl bg-[#FFF1D2] px-3.5 py-2.5 text-[12px] text-[#8a5f00]">
            Your shop is in draft. Add your first product to open for business.
          </div>
        )}

        {shop.status === "ACTIVE" && (
          <div className="mt-3 rounded-3xl border-[1.5px] border-line bg-white p-4 text-center">
            <div className="mb-1 font-display text-[14px] font-bold">
              Your storefront link
            </div>
            <CopyLink url={`${base}/s/${shop.slug}`} />
          </div>
        )}

        {/* -------- Products -------- */}
        <h2 className="mb-2 mt-6 font-display text-[15px] font-bold">Products</h2>
        {shop.products.length === 0 ? (
          <p className="mb-2 text-[13px] text-mute">Nothing listed yet.</p>
        ) : (
          <ul className="mb-2 space-y-2">
            {shop.products.map((product) => {
              const available = product.stock - product.reserved;
              return (
                <li
                  key={product.id}
                  className="flex items-center justify-between rounded-2xl border-[1.5px] border-line bg-white px-4 py-2.5"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.imageUrl}
                        alt=""
                        loading="lazy"
                        className="h-9 w-9 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <span aria-hidden className="text-[18px]">
                        {product.emoji ?? "🛍️"}
                      </span>
                    )}
                    <span className="truncate text-[14px] font-semibold">
                      {product.name}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span
                      className={`text-[12px] ${
                        available <= product.lowStockThreshold
                          ? "text-[#B23A0A]"
                          : "text-mute"
                      }`}
                    >
                      {available} left
                    </span>
                    <Money kobo={product.priceKobo} className="text-[13px]" />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <ProductForm shopId={shop.id} />

        {/* -------- Connections -------- */}
        <h2 className="mb-2 mt-6 font-display text-[15px] font-bold">
          Events you&apos;re connected to
        </h2>
        {shop.connections.length === 0 && (
          <p className="mb-2 text-[13px] text-mute">
            Not connected yet — your products aren&apos;t purchasable until an event
            accepts you.
          </p>
        )}
        <ul className="mb-3 space-y-2">
          {shop.connections.map((connection) => (
            <li
              key={connection.id}
              className="flex items-center justify-between gap-2 rounded-2xl border-[1.5px] border-line bg-white px-4 py-3"
            >
              <span className="min-w-0 truncate text-[13px] font-semibold">
                {connection.event.name}
              </span>
              <Chip
                tone={
                  connection.status === "ACTIVE"
                    ? "leaf"
                    : connection.status === "PENDING"
                      ? "gold"
                      : "line"
                }
              >
                {connection.status === "ACTIVE"
                  ? `Live · ${connection.revenueShareBps / 100}%`
                  : connection.status.toLowerCase()}
              </Chip>
            </li>
          ))}
        </ul>

        {shop.status !== "ACTIVE" ? (
          <p className="text-[12px] text-[#B23A0A]">
            Add at least one product before connecting to events.
          </p>
        ) : (
          connectableEvents.length > 0 && (
            <ConnectForm shopId={shop.id} events={connectableEvents} />
          )
        )}

        {/* -------- Orders -------- */}
        <h2 className="mb-2 mt-6 font-display text-[15px] font-bold">
          Orders {openOrders.length > 0 && `· ${openOrders.length} open`}
        </h2>
        {orders.length === 0 ? (
          <p className="text-[13px] text-mute">
            No orders yet — connect to an event and they land here.
          </p>
        ) : (
          <ul className="space-y-2 md:grid md:grid-cols-2 md:gap-2 md:space-y-0">
            {orders.map((order) => (
              <li key={order.id}>
                <OrderCard
                  order={{
                    id: order.id,
                    reference: order.reference,
                    buyerName: order.buyerName,
                    status: order.status,
                    totalKobo: order.totalKobo,
                    paid: Boolean(order.paidAt),
                    pickupCode: order.pickupCode,
                    items: order.items.map((i) => ({
                      name: i.nameSnapshot,
                      quantity: i.quantity,
                    })),
                  }}
                />
              </li>
            ))}
          </ul>
        )}

        {/* -------- Settlement -------- */}
        <h2 className="mb-1 mt-6 font-display text-[15px] font-bold">Settlement</h2>
        <p className="mb-1 text-[12px] text-mute">
          Direct deposit T+1 after the settlement trigger.
        </p>
        <Receipt
          title="Your sales, split"
          lines={[
            { label: "Gross sales", kobo: exampleSplit.grossKobo, strong: true },
            { label: "Earnival service charge (7.5%)", kobo: -exampleSplit.serviceFeeKobo },
            ...(exampleSplit.organiserShareKobo
              ? [
                  {
                    label: "Organiser share (connection)",
                    kobo: -exampleSplit.organiserShareKobo,
                  },
                ]
              : []),
          ]}
          total={{ label: "Your net", kobo: exampleSplit.vendorNetKobo }}
        />

        <Link
          href="/dashboard"
          className="mt-4 block text-center text-[13px] font-semibold text-plum"
        >
          Go to organiser console →
        </Link>
      </div>
    </div>
  );
}
