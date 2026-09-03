import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { isSandbox } from "@/lib/paystack";
import { formatNaira } from "@/lib/money";
import { TopBar } from "@/components/ui";
import { SandboxPayButtons } from "@/components/SandboxPayButtons";

export const metadata = { title: "Sandbox checkout", robots: { index: false } };

/**
 * Stands in for Paystack's hosted checkout when no API keys are configured, so
 * the entire purchase loop can be walked through locally. Returns 404 the
 * moment real credentials exist or NODE_ENV is production.
 */
export default async function SandboxPayPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  if (!isSandbox()) notFound();

  const { reference } = await params;
  const payment = await db.payment.findUnique({ where: { reference } });
  if (!payment) notFound();

  return (
    <div>
      <TopBar title="Sandbox checkout" />
      <div className="px-4 pb-16 pt-6">
        <div className="mb-4 rounded-2xl bg-[#FFF1D2] px-3.5 py-2.5 text-[12px] text-[#8a5f00]">
          <b>Sandbox mode.</b> No Paystack keys are configured, so this stands in for
          the real checkout. Set <code className="font-mono">PAYSTACK_SECRET_KEY</code>{" "}
          to use live payments.
        </div>

        <div className="rounded-3xl border-[1.5px] border-line bg-white p-5">
          <div className="text-[12px] uppercase tracking-wider text-mute">
            Amount due
          </div>
          <div className="font-display text-[30px] font-extrabold">
            {formatNaira(payment.amountKobo)}
          </div>
          <div className="mt-1 text-[13px] text-mute">
            {payment.buyerName} · {payment.buyerEmail}
          </div>
          <div className="mt-1 font-mono text-[12px] text-mute">{payment.reference}</div>
        </div>

        {payment.status === "SUCCESS" ? (
          <p className="mt-4 text-center text-[13px] text-leaf">
            Already paid. ✓
          </p>
        ) : (
          <SandboxPayButtons reference={payment.reference} />
        )}
      </div>
    </div>
  );
}
