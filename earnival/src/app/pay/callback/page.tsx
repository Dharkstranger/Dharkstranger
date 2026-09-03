import Link from "next/link";

import { db } from "@/lib/db";
import { settlePayment } from "@/lib/commerce";
import { isLive, verifyTransaction } from "@/lib/paystack";
import { ticketUrl } from "@/lib/qr";
import { Money, TopBar, btnClass } from "@/components/ui";

export const metadata = { title: "Payment", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PaymentCallback({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string }>;
}) {
  const { reference } = await searchParams;

  if (!reference) {
    return (
      <div>
        <TopBar title="Payment" />
        <div className="px-4 py-14 text-center text-[13px] text-mute">
          No payment reference supplied.
        </div>
      </div>
    );
  }

  let payment = await db.payment.findUnique({
    where: { reference },
    include: {
      tickets: { include: { ticketType: true, event: true } },
      orders: { include: { shop: true } },
    },
  });

  // Belt and braces: the webhook is authoritative, but it can lag behind the
  // buyer's redirect. Verifying here means the success page is never wrong —
  // and settlePayment is idempotent, so whichever path arrives second is a
  // no-op rather than a double credit.
  if (payment && payment.status === "PENDING" && isLive()) {
    try {
      const verified = await verifyTransaction(reference);
      if (verified.status === "success") {
        await settlePayment(reference, verified.raw);
        payment = await db.payment.findUnique({
          where: { reference },
          include: {
            tickets: { include: { ticketType: true, event: true } },
            orders: { include: { shop: true } },
          },
        });
      }
    } catch (error) {
      console.error("[pay/callback] verify failed:", error);
    }
  }

  if (!payment) {
    return (
      <div>
        <TopBar title="Payment" />
        <div className="px-4 py-14 text-center text-[13px] text-mute">
          We couldn&apos;t find that payment.
        </div>
      </div>
    );
  }

  if (payment.status !== "SUCCESS") {
    const pending = payment.status === "PENDING";
    return (
      <div>
        <TopBar title="Payment" />
        <div className="px-4 py-12 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-haze text-2xl">
            {pending ? "⏳" : "⚠️"}
          </div>
          <h1 className="font-display text-[18px] font-extrabold">
            {pending ? "Still confirming" : "Payment didn't go through"}
          </h1>
          <p className="mx-auto mt-1 max-w-[280px] text-[13px] text-mute">
            {pending
              ? "Your bank is confirming. This page updates once it clears — refresh in a moment."
              : "Nothing was charged. You can try again."}
          </p>
        </div>
      </div>
    );
  }

  const isTickets = payment.purpose === "TICKETS";

  return (
    <div>
      <TopBar title={isTickets ? "You're in!" : "Order confirmed"} />

      <div className="px-4 pb-16 pt-4">
        <div className="rounded-3xl border-[1.5px] border-leaf bg-[#E3F0E7] p-5 text-center">
          <div className="text-3xl">🎉</div>
          <h1 className="mt-1 font-display text-[18px] font-extrabold">
            {isTickets ? "Ticket secured" : "Order placed"}
          </h1>
          <p className="mt-1 text-[12px] text-[#3d5748]">
            Sent to {payment.buyerEmail}
          </p>
          <div className="mt-2">
            <Money kobo={payment.amountKobo} className="text-[15px] text-leaf" />
          </div>
        </div>

        {isTickets && payment.tickets.length > 0 && (
          <>
            <h2 className="mb-2 mt-5 font-display text-[15px] font-bold">
              Your {payment.tickets.length > 1 ? "badges" : "badge"}
            </h2>
            <ul className="space-y-2">
              {payment.tickets.map((ticket) => (
                <li key={ticket.id}>
                  <Link
                    href={`/t/${ticket.qrToken}`}
                    className="flex items-center justify-between rounded-2xl border-[1.5px] border-marigold bg-white px-4 py-3"
                  >
                    <span>
                      <span className="block text-[14px] font-semibold">
                        {ticket.ticketType.name}
                      </span>
                      <span className="block font-mono text-[12px] text-mute">
                        {ticket.code}
                      </span>
                    </span>
                    <span className="text-[13px] font-semibold text-plum">
                      View QR →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href={`/e/${payment.tickets[0].event.slug}`}
              className={`${btnClass("flame")} mt-4`}
            >
              Shop the event
            </Link>
          </>
        )}

        {!isTickets && payment.orders.length > 0 && (
          <>
            <h2 className="mb-2 mt-5 font-display text-[15px] font-bold">
              Your {payment.orders.length > 1 ? "orders" : "order"}
            </h2>
            <ul className="space-y-2">
              {payment.orders.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/orders/${order.reference}`}
                    className="flex items-center justify-between rounded-2xl border-[1.5px] border-line bg-white px-4 py-3"
                  >
                    <span>
                      <span className="block font-mono text-[13px] font-semibold">
                        {order.reference}
                      </span>
                      <span className="block text-[12px] text-mute">
                        {order.shop.name}
                      </span>
                    </span>
                    <span className="text-[13px] font-semibold text-plum">Track →</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
