import Link from "next/link";

import { POLICY_VERSIONS, REFUND_SUMMARY } from "@/lib/legal";
import { PLAN_SERVICE_FEE_BPS } from "@/lib/money";
import { TopBar } from "@/components/ui";

export const metadata = {
  title: "Terms of service",
  description: "The agreement between you and Earnival.",
};

export default function TermsPage() {
  return (
    <div className="pb-16">
      <TopBar title="Terms of service" backHref="/" />

      <article className="px-4 pt-4 text-[14px] leading-relaxed">
        <p className="text-[13px] text-mute">Version {POLICY_VERSIONS.terms}.</p>

        <Section title="What Earnival does">
          <p>
            Earnival lets organisers sell tickets and vendors sell products at events,
            and settles the money between everyone involved. We are not the organiser
            of any event, and we are not the seller of any product. The contract for
            an event or an item is between you and whoever is running or selling it.
          </p>
        </Section>

        <Section title="What we charge">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              A service charge on each transaction, currently{" "}
              {PLAN_SERVICE_FEE_BPS.STARTER / 100}% on the Starter plan, deducted from
              the seller.
            </li>
            <li>
              A payment processing fee, added to the buyer&apos;s total and shown before
              you pay.
            </li>
            <li>
              Where a shop is connected to an event, the organiser&apos;s agreed share
              of that shop&apos;s sales — agreed in advance, and visible to both sides
              before either accepts.
            </li>
            <li>No listing fee, and no charge for creating an event or a shop.</li>
          </ul>
        </Section>

        <Section title="Refunds">
          <p className="font-semibold">{REFUND_SUMMARY.headline}</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {REFUND_SUMMARY.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </Section>

        <Section title="If you sell on Earnival">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              You are responsible for the event or goods you sell, including being
              accurate about what buyers get.
            </li>
            <li>
              Revenue limits apply based on how far you have verified your account.
              Verifying further raises them.
            </li>
            <li>
              Settlement is paid to the bank account you have verified, on the cadence
              your verification level allows, one business day after the trigger.
            </li>
            <li>
              We may hold or reverse a settlement where there is a credible dispute,
              suspected fraud, or an event is cancelled.
            </li>
          </ul>
        </Section>

        <Section title="Tickets">
          <p>
            A ticket is a licence to enter, granted by the organiser. Its QR code is
            signed and single-use at the gate — treat the link like cash, since anyone
            holding it can present it. Reselling above face value may be restricted by
            the organiser or by law.
          </p>
        </Section>

        <Section title="Things you must not do">
          <ul className="list-disc space-y-1 pl-5">
            <li>List an event or item you have no right to sell.</li>
            <li>Use Earnival to launder money or take payment for illegal goods.</li>
            <li>
              Automate purchases to hoard inventory, or interfere with anyone else&apos;s
              access to the service.
            </li>
            <li>Attempt to forge, copy or resell a check-in code.</li>
          </ul>
        </Section>

        <Section title="Liability">
          <p>
            We provide the platform as it is. We do not accept liability for an event
            being cancelled, postponed, or not living up to its description — that sits
            with the organiser — though we will process refunds where an event is
            cancelled. Nothing here limits liability that cannot be limited by law.
          </p>
        </Section>

        <Section title="Governing law">
          <p>
            These terms are governed by the laws of the Federal Republic of Nigeria.
          </p>
        </Section>

        <p className="mt-8 text-[13px] text-mute">
          Questions:{" "}
          <a href="mailto:support@earnival.app" className="text-plum underline">
            support@earnival.app
          </a>{" "}
          · See also our{" "}
          <Link href="/privacy" className="text-plum underline">
            privacy policy
          </Link>
          .
        </p>
      </article>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-1.5 font-display text-[16px] font-bold">{title}</h2>
      <div className="space-y-2 text-[#463D52]">{children}</div>
    </section>
  );
}
