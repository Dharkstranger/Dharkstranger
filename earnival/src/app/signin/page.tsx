import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { TopBar } from "@/components/ui";
import { SignInForm } from "@/components/SignInForm";

export const metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(next ?? "/dashboard");

  return (
    <div>
      <TopBar title="Sign in" backHref="/" />
      <div className="px-4 pb-24 pt-6">
        <h1 className="font-display text-[24px] font-extrabold leading-tight">
          Sign in to sell
          <br />
          and run events.
        </h1>
        <p className="mb-6 mt-1 text-[13px] text-mute">
          Buying a ticket never needs an account. This is for organisers and vendors —
          so your events, shop and money stay yours across devices.
        </p>
        <SignInForm next={next ?? "/dashboard"} />

        <p className="mt-6 text-center text-[13px] text-mute">
          Just looking for a ticket you bought?{" "}
          <a href="/find" className="font-semibold text-plum underline">
            Find it without an account
          </a>
        </p>
      </div>
    </div>
  );
}
