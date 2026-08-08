import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { unsettledBalance } from "@/lib/ledger";
import { formatNaira } from "@/lib/money";
import { listBanks } from "@/lib/paystack";
import { entitlementsFor } from "@/lib/verification";
import { MINIMUM_PAYOUT_KOBO } from "@/lib/settlement";
import { Chip, Money, TopBar } from "@/components/ui";
import { BankAccountForm } from "@/components/BankAccountForm";

export const metadata = { title: "Payouts" };
export const dynamic = "force-dynamic";

export default async function PayoutsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?next=/payouts");

  const [accounts, settlements, balance, banks] = await Promise.all([
    db.payoutAccount.findMany({
      where: { userId: user.id },
      orderBy: { isDefault: "desc" },
    }),
    db.settlement.findMany({
      where: { partyId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    unsettledBalance(user.id),
    listBanks().catch(() => []),
  ]);

  const entitlements = entitlementsFor(user.verificationLevel);

  return (
    <div className="pb-16">
      <TopBar title="Payouts" backHref="/dashboard" />

      <div className="px-4 pt-4">
        <div className="rounded-3xl bg-night p-4 text-white">
          <div className="text-[11px] text-[#C9BFD6]">Awaiting settlement</div>
          <Money kobo={balance} className="text-[26px] text-white" />
          <div className="mt-2 flex justify-between text-[11px] text-[#C9BFD6]">
            <span>Your cadence</span>
            <b className="text-marigold">
              {entitlements.settlementCadence === "DAILY"
                ? "Daily"
                : "After each event ends"}
            </b>
          </div>
          <div className="mt-1 text-[11px] text-[#C9BFD6]">
            Payouts land T+1 after the trigger. Minimum{" "}
            {formatNaira(MINIMUM_PAYOUT_KOBO)}.
          </div>
        </div>

        {balance < 0 && (
          <div className="mt-3 rounded-2xl bg-[#FFF1D2] px-3.5 py-2.5 text-[12px] text-[#8a5f00]">
            Refunds have taken your balance below zero. Nothing pays out until
            future sales bring it back up.
          </div>
        )}

        {entitlements.settlementCadence === "POST_EVENT" && (
          <div className="mt-3 rounded-2xl bg-[#EEE6F9] px-3.5 py-2.5 text-[12px] text-plum">
            Verify your identity to switch to daily settlement instead of waiting
            for each event to finish.
          </div>
        )}

        {/* ---- Bank accounts ---- */}
        <h2 className="mb-2 mt-6 font-display text-[15px] font-bold">
          Where your money goes
        </h2>

        {accounts.length === 0 ? (
          <p className="mb-3 text-[13px] text-mute">
            No bank account yet. Add one — nothing can pay out until you do.
          </p>
        ) : (
          <ul className="mb-3 space-y-2">
            {accounts.map((account) => (
              <li
                key={account.id}
                className="flex items-center justify-between rounded-2xl border-[1.5px] border-line bg-white px-4 py-3"
              >
                <div>
                  <div className="text-[13px] font-semibold">{account.accountName}</div>
                  <div className="font-mono text-[11px] text-mute">
                    {account.bankName} · ••••{account.accountNumber.slice(-4)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {account.isDefault && <Chip tone="plum">Default</Chip>}
                  {account.verified && <Chip tone="leaf">Verified</Chip>}
                </div>
              </li>
            ))}
          </ul>
        )}

        {accounts.length === 0 && <BankAccountForm banks={banks} />}

        {/* ---- History ---- */}
        <h2 className="mb-2 mt-6 font-display text-[15px] font-bold">
          Settlement history
        </h2>
        {settlements.length === 0 ? (
          <p className="text-[13px] text-mute">
            No payouts yet. Once you make a sale it shows up here.
          </p>
        ) : (
          <ul className="space-y-2">
            {settlements.map((settlement) => (
              <li
                key={settlement.id}
                className="rounded-2xl border-[1.5px] border-line bg-white px-4 py-3"
              >
                <div className="flex items-center justify-between">
                  <Money kobo={settlement.amountKobo} className="text-[15px]" />
                  <Chip
                    tone={
                      settlement.status === "PAID"
                        ? "leaf"
                        : settlement.status === "FAILED"
                          ? "flame"
                          : "gold"
                    }
                  >
                    {settlement.status.toLowerCase()}
                  </Chip>
                </div>
                <div className="mt-0.5 text-[11px] text-mute">
                  {settlement.periodStart.toLocaleDateString("en-NG", {
                    day: "numeric",
                    month: "short",
                  })}
                  {" – "}
                  {settlement.periodEnd.toLocaleDateString("en-NG", {
                    day: "numeric",
                    month: "short",
                  })}
                  {settlement.paidAt &&
                    ` · paid ${settlement.paidAt.toLocaleDateString("en-NG", {
                      day: "numeric",
                      month: "short",
                    })}`}
                </div>
                {settlement.failureReason && (
                  <div className="mt-1 text-[11px] text-[#B23A0A]">
                    {settlement.failureReason} — this will be retried automatically.
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
