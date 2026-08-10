import { notFound, redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { eventAccess } from "@/lib/permissions";
import { formatNaira } from "@/lib/money";
import { Chip, TopBar } from "@/components/ui";
import { InviteMemberForm } from "@/components/InviteMemberForm";
import { RevokeMemberButton } from "@/components/RevokeMemberButton";

export const metadata = { title: "Event team" };
export const dynamic = "force-dynamic";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const { id } = await params;
  const access = await eventAccess({
    userId: user.id,
    eventId: id,
    capability: "editEvent",
  });
  if (!access.allowed) notFound();

  const event = await db.event.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      name: true,
      organiser: { select: { name: true, email: true } },
      members: { orderBy: { createdAt: "desc" } },
    },
  });

  const active = event.members.filter((m) => m.status === "ACCEPTED");
  const pending = event.members.filter((m) => m.status === "PENDING");
  const past = event.members.filter(
    (m) => m.status === "REJECTED" || m.status === "REVOKED",
  );

  return (
    <div className="pb-16">
      <TopBar title="Event team" backHref={`/dashboard/events/${event.id}`} />

      <div className="px-4 pt-4 lg:px-6">
        <p className="mb-4 text-[13px] text-mute">
          One phone at the gate isn&apos;t enough. Add door staff so more than one
          person can check guests in, and cohosts if someone earns a share.
        </p>

        <div className="mb-4 rounded-2xl border-[1.5px] border-line bg-white px-4 py-3">
          <div className="text-[12px] uppercase tracking-wider text-mute">Organiser</div>
          <div className="text-[14px] font-semibold">
            {event.organiser.name ?? event.organiser.email}
          </div>
          <div className="text-[12px] text-mute">Full access · owns the event</div>
        </div>

        <h2 className="mb-2 font-display text-[15px] font-bold">
          On the team {active.length > 0 && `· ${active.length}`}
        </h2>

        {active.length === 0 && pending.length === 0 && (
          <p className="mb-4 text-[13px] text-mute">
            Nobody else yet. On the night, only you can scan tickets.
          </p>
        )}

        <ul className="mb-4 space-y-2">
          {[...active, ...pending].map((member) => (
            <li
              key={member.id}
              className="rounded-2xl border-[1.5px] border-line bg-white px-4 py-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold">
                    {member.inviteEmail}
                  </div>
                  <div className="text-[12px] text-mute">
                    {member.role === "COHOST" ? "Cohost" : "Door staff"}
                  </div>
                </div>
                <Chip tone={member.status === "ACCEPTED" ? "leaf" : "gold"}>
                  {member.status === "ACCEPTED" ? "Active" : "Invited"}
                </Chip>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {member.canCheckIn && <Chip tone="plum">Check in</Chip>}
                {member.canEditEvent && <Chip tone="plum">Edit event</Chip>}
                {member.canManageShops && <Chip tone="plum">Shops</Chip>}
                {member.canRefund && <Chip tone="flame">Refunds</Chip>}
              </div>

              {member.earns && (
                <div className="mt-2 rounded-xl bg-paper px-3 py-2 text-[12px]">
                  Earns{" "}
                  <b>
                    {member.shareType === "PERCENT"
                      ? `${(member.shareBps ?? 0) / 100}%`
                      : formatNaira(member.shareFlatKobo ?? 0)}
                  </b>{" "}
                  of{" "}
                  {member.revenueLine === "TICKET_SALES"
                    ? "ticket revenue"
                    : member.revenueLine === "SHOP_SHARE"
                      ? "your shop share"
                      : "sponsorship"}
                  <div className="mt-0.5 text-mute">
                    Comes out of your share, never the vendor&apos;s.
                  </div>
                </div>
              )}

              <div className="mt-2">
                <RevokeMemberButton memberId={member.id} />
              </div>
            </li>
          ))}
        </ul>

        <h2 className="mb-2 mt-6 font-display text-[15px] font-bold">Add someone</h2>
        <InviteMemberForm eventId={event.id} />

        {past.length > 0 && (
          <>
            <h2 className="mb-2 mt-6 font-display text-[15px] font-bold">Past</h2>
            <ul className="space-y-1.5">
              {past.map((member) => (
                <li
                  key={member.id}
                  className="flex items-center justify-between rounded-xl border-[1.5px] border-line bg-white px-3.5 py-2.5 text-[13px]"
                >
                  <span className="truncate text-mute">{member.inviteEmail}</span>
                  <Chip tone="line">{member.status.toLowerCase()}</Chip>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
