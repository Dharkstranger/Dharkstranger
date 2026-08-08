import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { LEVELS, LEVEL_ORDER, entitlementsFor } from "@/lib/verification";
import { formatNaira } from "@/lib/money";
import { Chip, TopBar } from "@/components/ui";
import { VerifyPhone } from "@/components/VerifyPhone";
import { VerifyIdentity } from "@/components/VerifyIdentity";
import { VerifyBusiness } from "@/components/VerifyBusiness";

export const metadata = { title: "Verification" };
export const dynamic = "force-dynamic";

export default async function VerifyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?next=/verify");

  const submissions = await db.verificationSubmission.findMany({
    where: { userId: user.id },
    // `encryptedPayload` is deliberately excluded — nothing outside the review
    // path ever needs the raw identifier.
    select: {
      id: true,
      kind: true,
      status: true,
      last4: true,
      businessName: true,
      rejectionReason: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const current = entitlementsFor(user.verificationLevel);
  const currentIndex = LEVEL_ORDER.indexOf(user.verificationLevel);

  const pendingIdentity = submissions.find(
    (s) => (s.kind === "BVN" || s.kind === "NIN") && s.status === "PENDING",
  );
  const pendingBusiness = submissions.find(
    (s) => s.kind === "CAC_TIN" && s.status === "PENDING",
  );

  return (
    <div className="pb-16">
      <TopBar title="Verification" backHref="/dashboard" />

      <div className="px-4 pt-4">
        <div className="rounded-3xl bg-night p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] text-[#C9BFD6]">Your level</div>
              <div className="font-display text-[24px] font-extrabold">
                {user.verificationLevel} · {current.label}
              </div>
            </div>
            {user.verificationBadge && <Chip tone="leaf">Verified</Chip>}
          </div>
          <div className="mt-3 flex justify-between text-[12px] text-[#C9BFD6]">
            <span>Revenue per event</span>
            <b className="text-marigold">
              {current.revenueCapKobo === null
                ? "Unlimited"
                : formatNaira(current.revenueCapKobo)}
            </b>
          </div>
          <div className="mt-1 flex justify-between text-[12px] text-[#C9BFD6]">
            <span>Settlement</span>
            <b className="text-white">
              {current.settlementCadence === "DAILY" ? "Daily" : "After each event"}
            </b>
          </div>
        </div>

        {/* Ladder overview */}
        <ol className="mt-4 space-y-2">
          {LEVEL_ORDER.map((level, index) => {
            const entitlements = LEVELS[level];
            const reached = index <= currentIndex;
            const isNext = index === currentIndex + 1;
            return (
              <li
                key={level}
                className={`rounded-2xl border-[1.5px] p-3.5 ${
                  reached
                    ? "border-leaf bg-[#E3F0E7]"
                    : isNext
                      ? "border-marigold bg-white"
                      : "border-line bg-white opacity-60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-display text-[14px] font-bold">
                    {level} · {entitlements.label}
                  </div>
                  {reached ? (
                    <Chip tone="leaf">Done</Chip>
                  ) : isNext ? (
                    <Chip tone="gold">Next</Chip>
                  ) : null}
                </div>
                <ul className="mt-1.5 space-y-0.5">
                  {entitlements.unlocks.map((unlock) => (
                    <li key={unlock} className="text-[12px] text-mute">
                      · {unlock}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>

        {/* Next action */}
        <h2 className="mb-2 mt-6 font-display text-[15px] font-bold">
          {currentIndex >= LEVEL_ORDER.length - 1
            ? "You're fully verified"
            : "Move up a level"}
        </h2>

        {user.verificationLevel === "L0" && <VerifyPhone />}

        {user.verificationLevel === "L1" &&
          (pendingIdentity ? (
            <PendingCard
              title={`${pendingIdentity.kind} ending ${pendingIdentity.last4}`}
              body="Submitted for review. We'll email you when it's checked — usually within a day."
            />
          ) : (
            <VerifyIdentity />
          ))}

        {user.verificationLevel === "L2" &&
          (pendingBusiness ? (
            <PendingCard
              title={pendingBusiness.businessName ?? "Business details"}
              body="Submitted for review. We'll email you when it's checked."
            />
          ) : (
            <VerifyBusiness />
          ))}

        {user.verificationLevel === "L3" && (
          <div className="rounded-2xl border-[1.5px] border-leaf bg-[#E3F0E7] p-4 text-[13px]">
            Everything is verified. You have unlimited revenue, daily settlement and
            a verified badge.
          </div>
        )}

        {/* History */}
        {submissions.length > 0 && (
          <>
            <h2 className="mb-2 mt-6 font-display text-[15px] font-bold">History</h2>
            <ul className="space-y-2">
              {submissions.map((submission) => (
                <li
                  key={submission.id}
                  className="flex items-center justify-between rounded-2xl border-[1.5px] border-line bg-white px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold">
                      {submission.kind === "CAC_TIN"
                        ? (submission.businessName ?? "Business")
                        : `${submission.kind}${
                            submission.last4 ? ` ••••${submission.last4}` : ""
                          }`}
                    </div>
                    <div className="text-[11px] text-mute">
                      {submission.createdAt.toLocaleDateString("en-NG", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      {submission.rejectionReason && ` · ${submission.rejectionReason}`}
                    </div>
                  </div>
                  <Chip
                    tone={
                      submission.status === "APPROVED"
                        ? "leaf"
                        : submission.status === "REJECTED"
                          ? "flame"
                          : "gold"
                    }
                  >
                    {submission.status.toLowerCase()}
                  </Chip>
                </li>
              ))}
            </ul>
          </>
        )}

        <p className="mt-6 text-[11px] leading-relaxed text-mute">
          Your BVN, NIN and TIN are encrypted before they are stored, and only the
          last four digits are ever shown — to you or to our reviewers. We use them
          solely to verify your identity, in line with the NDPR.
        </p>
      </div>
    </div>
  );
}

function PendingCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border-[1.5px] border-marigold bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="font-display text-[14px] font-bold">{title}</div>
        <Chip tone="gold">Under review</Chip>
      </div>
      <p className="mt-1 text-[12px] text-mute">{body}</p>
    </div>
  );
}
