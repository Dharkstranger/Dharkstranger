import { TopBar } from "@/components/ui";
import { FindTicketsForm } from "@/components/FindTicketsForm";

export const metadata = {
  title: "Find my tickets",
  description: "Lost your ticket email? Get your tickets and orders back.",
};

export default function FindPage() {
  return (
    <div>
      <TopBar title="Find my tickets" backHref="/" />
      <div className="px-4 pb-24 pt-6">
        <h1 className="font-display text-[24px] font-extrabold leading-tight">
          Lost your ticket?
        </h1>
        <p className="mb-6 mt-1 text-[14px] text-mute">
          Enter the email you used at checkout and we&apos;ll send everything back to
          you — tickets, QR codes and order status. No account needed.
        </p>
        <FindTicketsForm />
      </div>
    </div>
  );
}
