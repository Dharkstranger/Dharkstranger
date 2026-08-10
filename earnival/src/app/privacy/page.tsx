import Link from "next/link";

import { POLICY_VERSIONS } from "@/lib/legal";
import { TopBar } from "@/components/ui";

export const metadata = {
  title: "Privacy policy",
  description: "How Earnival handles your personal data under the NDPR.",
};

export default function PrivacyPage() {
  return (
    <div className="pb-16">
      <TopBar title="Privacy policy" backHref="/" />

      <article className="prose-earnival px-4 pt-4 text-[14px] leading-relaxed">
        <p className="text-[13px] text-mute">
          Version {POLICY_VERSIONS.privacy}. This describes how Earnival collects and
          uses personal data, in line with the Nigeria Data Protection Act and the
          NDPR.
        </p>

        <Section title="Who we are">
          <p>
            Earnival is a commerce platform for events. When you buy a ticket or place
            an order, we act as the data controller for the account and payment
            information we hold, and as a processor for information the organiser or
            vendor collects through us.
          </p>
        </Section>

        <Section title="What we collect">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <b>When you buy:</b> your name, email address and phone number. We need
              these to send your ticket and let the organiser check you in.
            </li>
            <li>
              <b>When you sell:</b> the same, plus your bank account details so we can
              pay you, and — only if you choose to raise your limits — your BVN or NIN,
              or your CAC registration number and TIN.
            </li>
            <li>
              <b>Automatically:</b> a rotating visitor identifier, and the pages you
              opened on an event site. We do not use advertising trackers.
            </li>
          </ul>
        </Section>

        <Section title="Identity documents">
          <p>
            BVN, NIN and TIN are encrypted before they are stored, using a key held
            separately from the database. Only the last four digits are ever displayed
            — to you, or to the member of our team reviewing your submission. We use
            them solely to verify who you are, and for no other purpose.
          </p>
        </Section>

        <Section title="Why we can use it">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <b>Contract:</b> to sell you a ticket, deliver it, and pay sellers what
              they are owed.
            </li>
            <li>
              <b>Legal obligation:</b> identity checks and financial record-keeping.
            </li>
            <li>
              <b>Consent:</b> marketing emails, which you opt into separately and can
              withdraw at any time.
            </li>
          </ul>
        </Section>

        <Section title="Who sees it">
          <p>
            The organiser of an event you buy a ticket to sees your name, email and
            check-in status. A vendor you order from sees your name and the items you
            ordered — never your payment details. Payments are handled by Paystack;
            email by our delivery provider. We do not sell personal data to anyone.
          </p>
        </Section>

        <Section title="How long we keep it">
          <p>
            Ticket and order records are kept for seven years to meet financial
            record-keeping requirements. Identity documents are deleted once your
            verification is decided and the appeal window has passed. Analytics data is
            aggregated after 24 months.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            You can ask for a copy of your data, ask us to correct it, ask us to delete
            it where we are not required to keep it, and withdraw consent for marketing
            at any time. Write to{" "}
            <a href="mailto:privacy@earnival.app" className="text-plum underline">
              privacy@earnival.app
            </a>{" "}
            and we will respond within 30 days. You may also complain to the Nigeria
            Data Protection Commission.
          </p>
        </Section>

        <Section title="Security">
          <p>
            Traffic is encrypted in transit. Identity documents are encrypted at rest.
            Ticket QR codes are cryptographically signed so they cannot be forged.
            Access to personal data inside Earnival is limited to the people who need
            it to do their job.
          </p>
        </Section>

        <p className="mt-8 text-[13px] text-mute">
          Questions:{" "}
          <a href="mailto:privacy@earnival.app" className="text-plum underline">
            privacy@earnival.app
          </a>{" "}
          · See also our{" "}
          <Link href="/terms" className="text-plum underline">
            terms
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
