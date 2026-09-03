import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatNaira } from "@/lib/money";
import { Chip, TopBar } from "@/components/ui";
import { ReviewEvent } from "@/components/ReviewEvent";
import { ReviewVerification } from "@/components/ReviewVerification";
import { ReplayWebhook } from "@/components/ReplayWebhook";

export const metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?next=/admin");
  if (!user.isAdmin) notFound();

  const [events, submissions, settlements, refunds] = await Promise.all([
    db.event.findMany({
      where: { approvalStatus: "PENDING_REVIEW" },
      include: {
        organiser: { select: { name: true, email: true, verificationLevel: true } },
        ticketTypes: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    db.verificationSubmission.findMany({
      where: { status: "PENDING" },
      select: {
        id: true,
        kind: true,
        last4: true,
        businessName: true,
        targetLevel: true,
        createdAt: true,
        user: { select: { name: true, email: true, verificationLevel: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.settlement.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { party: { select: { name: true, email: true } } },
    }),
    db.refund.findMany({
      where: { status: { in: ["PENDING", "PROCESSING", "FAILED"] } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const failedWebhooks = await db.webhookEvent.findMany({
    where: { processedAt: null, error: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <div className="pb-16">
      <TopBar title="Admin" backHref="/dashboard" />

      <div className="px-4 pt-4">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Events" value={events.length} />
          <Stat label="KYC" value={submissions.length} />
          <Stat label="Refunds" value={refunds.length} />
        </div>

        {/* ---- Event approval queue (ADM-01) ---- */}
        <h2 className="mb-2 mt-6 font-display text-[15px] font-bold">
          Paid events awaiting review
        </h2>
        {events.length === 0 ? (
          <p className="text-[13px] text-mute">Nothing waiting. 🎉</p>
        ) : (
          <ul className="space-y-3">
            {events.map((event) => (
              <li key={event.id}>
                <ReviewEvent
                  eventId={event.id}
                  name={event.name}
                  slug={event.slug}
                  venue={event.venue}
                  startsAt={event.startsAt.toLocaleDateString("en-NG", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                  organiserName={event.organiser.name ?? event.organiser.email}
                  organiserLevel={event.organiser.verificationLevel}
                  ticketSummary={event.ticketTypes
                    .map((t) => `${t.name} ${formatNaira(t.priceKobo)} ×${t.quantity}`)
                    .join(" · ")}
                />
              </li>
            ))}
          </ul>
        )}

        {/* ---- KYC review (ADM-02) ---- */}
        <h2 className="mb-2 mt-6 font-display text-[15px] font-bold">
          Verification submissions
        </h2>
        {submissions.length === 0 ? (
          <p className="text-[13px] text-mute">Nothing waiting.</p>
        ) : (
          <ul className="space-y-3">
            {submissions.map((submission) => (
              <li key={submission.id}>
                <ReviewVerification
                  submissionId={submission.id}
                  kind={submission.kind}
                  last4={submission.last4}
                  businessName={submission.businessName}
                  targetLevel={submission.targetLevel}
                  userName={submission.user.name ?? submission.user.email}
                  currentLevel={submission.user.verificationLevel}
                />
              </li>
            ))}
          </ul>
        )}

        {/* ---- Money operations ---- */}
        <h2 className="mb-2 mt-6 font-display text-[15px] font-bold">
          Recent settlements
        </h2>
        {settlements.length === 0 ? (
          <p className="text-[13px] text-mute">No payouts yet.</p>
        ) : (
          <ul className="space-y-2">
            {settlements.map((settlement) => (
              <li
                key={settlement.id}
                className="flex items-center justify-between rounded-2xl border-[1.5px] border-line bg-white px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold">
                    {settlement.party.name ?? settlement.party.email}
                  </div>
                  <div className="font-mono text-[12px] text-mute">
                    {settlement.reference}
                    {settlement.failureReason && ` · ${settlement.failureReason}`}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-[13px] font-bold">
                    {formatNaira(settlement.amountKobo)}
                  </span>
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
              </li>
            ))}
          </ul>
        )}

        {refunds.length > 0 && (
          <>
            <h2 className="mb-2 mt-6 font-display text-[15px] font-bold">
              Refunds needing attention
            </h2>
            <ul className="space-y-2">
              {refunds.map((refund) => (
                <li
                  key={refund.id}
                  className="rounded-2xl border-[1.5px] border-line bg-white px-4 py-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[12px]">{refund.reference}</span>
                    <Chip tone={refund.status === "FAILED" ? "flame" : "gold"}>
                      {refund.status.toLowerCase()}
                    </Chip>
                  </div>
                  <div className="mt-0.5 text-[12px] text-mute">
                    {formatNaira(refund.amountKobo)} ·{" "}
                    {refund.reason.toLowerCase().replace(/_/g, " ")}
                    {refund.failureReason && ` · ${refund.failureReason}`}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {failedWebhooks.length > 0 && (
          <>
            <h2 className="mb-2 mt-6 font-display text-[15px] font-bold">
              Webhooks that failed to process
            </h2>
            <p className="mb-2 text-[13px] text-mute">
              Replaying is safe — settlement is idempotent, so one that already
              succeeded does nothing.
            </p>
            <ul className="space-y-2">
              {failedWebhooks.map((hook) => (
                <li
                  key={hook.id}
                  className="rounded-2xl border-[1.5px] border-[#B23A0A] bg-white px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[12px] font-semibold">
                      {hook.eventType}
                    </span>
                    <span className="text-[12px] text-mute">
                      {hook.createdAt.toLocaleString("en-NG", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[12px] text-[#B23A0A]">{hook.error}</div>
                  <ReplayWebhook webhookEventId={hook.id} />
                </li>
              ))}
            </ul>
          </>
        )}

        <Link
          href="/dashboard"
          className="mt-6 block text-center text-[13px] font-semibold text-plum"
        >
          Back to your console →
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border-[1.5px] border-line bg-white px-3 py-3 text-center">
      <div className="font-display text-[20px] font-extrabold">{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-mute">{label}</div>
    </div>
  );
}
