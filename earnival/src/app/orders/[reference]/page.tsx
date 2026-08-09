import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { Chip, Money, TopBar } from "@/components/ui";

export const metadata = { title: "Your order", robots: { index: false } };

const STATUS_COPY: Record<string, { label: string; body: string }> = {
  CREATED: { label: "Order placed", body: "The shop has your order. Pay at the event." },
  PENDING_PAYMENT: { label: "Awaiting payment", body: "Finish payment to confirm." },
  PAID: { label: "Paid", body: "The shop is getting it ready." },
  PREPARING: { label: "Preparing", body: "The shop is getting it ready." },
  READY: { label: "Ready for pickup", body: "Show your pickup code at the stand." },
  COMPLETED: { label: "Collected", body: "Enjoy." },
  CANCELLED: { label: "Cancelled", body: "This order was cancelled." },
};

export default async function OrderPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;

  const order = await db.order.findUnique({
    where: { reference: decodeURIComponent(reference) },
    include: { shop: true, items: true, event: true },
  });
  if (!order) notFound();

  const status = STATUS_COPY[order.status] ?? { label: order.status, body: "" };
  const siblings = await db.order.findMany({
    where: { groupRef: order.groupRef, id: { not: order.id } },
    select: { reference: true, shop: { select: { name: true } }, status: true },
  });

  return (
    <div>
      <TopBar
        title="Your order"
        backHref={order.event ? `/e/${order.event.slug}` : "/"}
      />

      <div className="px-4 pb-16 pt-4">
        <div className="rounded-3xl border-[1.5px] border-line bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-mono text-[15px] font-bold">{order.reference}</div>
              <div className="text-[13px] text-mute">{order.shop.name}</div>
            </div>
            <Chip
              tone={
                order.status === "COMPLETED"
                  ? "leaf"
                  : order.status === "READY"
                    ? "gold"
                    : order.status === "CANCELLED"
                      ? "flame"
                      : "line"
              }
            >
              {status.label}
            </Chip>
          </div>

          <p className="mt-2 text-[13px] text-mute">{status.body}</p>

          {order.pickupCode && order.status === "READY" && (
            <div className="mt-4 rounded-2xl bg-[#FFF1D2] px-4 py-3 text-center">
              <div className="text-[12px] uppercase tracking-wider text-[#8a5f00]">
                Pickup code
              </div>
              <div className="font-mono text-[26px] font-bold tracking-[0.2em] text-[#8a5f00]">
                {order.pickupCode}
              </div>
            </div>
          )}

          <ul className="mt-4 border-t border-dashed border-line pt-3">
            {order.items.map((item) => (
              <li
                key={item.id}
                className="flex justify-between py-1 text-[13px]"
              >
                <span>
                  {item.nameSnapshot} <span className="text-mute">×{item.quantity}</span>
                </span>
                <Money
                  kobo={item.unitPriceKobo * item.quantity}
                  className="text-[13px] font-normal"
                />
              </li>
            ))}
            {order.processingFeeKobo > 0 && (
              <li className="flex justify-between py-1 text-[13px] text-mute">
                <span>Processing</span>
                <Money kobo={order.processingFeeKobo} className="text-[13px] font-normal" />
              </li>
            )}
            <li className="mt-1 flex justify-between border-t-[1.5px] border-line py-1.5 font-bold">
              <span>Total</span>
              <Money kobo={order.totalKobo} />
            </li>
          </ul>

          <div className="mt-3 text-[12px] text-mute">
            {order.paidAt ? (
              <>✓ Paid · locked</>
            ) : (
              <>⏱ Pay at the event — {order.shop.name}&apos;s stand</>
            )}
          </div>
        </div>

        {siblings.length > 0 && (
          <>
            <h2 className="mb-2 mt-5 font-display text-[15px] font-bold">
              Rest of this basket
            </h2>
            <p className="mb-2 text-[12px] text-mute">
              Each shop fulfils separately — one may be ready before another.
            </p>
            <ul className="space-y-2">
              {siblings.map((sibling) => (
                <li key={sibling.reference}>
                  <a
                    href={`/orders/${sibling.reference}`}
                    className="flex items-center justify-between rounded-2xl border-[1.5px] border-line bg-white px-4 py-3 text-[13px]"
                  >
                    <span className="font-semibold">{sibling.shop.name}</span>
                    <Chip tone={sibling.status === "COMPLETED" ? "leaf" : "line"}>
                      {sibling.status.toLowerCase()}
                    </Chip>
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
