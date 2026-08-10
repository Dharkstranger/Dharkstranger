import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatNaira } from "@/lib/money";
import { Chip, TopBar } from "@/components/ui";
import { RespondToInvite } from "@/components/RespondToInvite";

export const metadata = { title: "Invitations" };
export const dynamic = "force-dynamic";

export default async function InvitationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?next=/dashboard/invitations");

  // Match on user id OR email: the invitation may predate the account.
  const identity = [{ userId: user.id }, { inviteEmail: user.email }];

  const [eventInvites, shopInvites] = await Promise.all([
    db.eventMember.findMany({
      where: { status: "PENDING", OR: identity },
      include: {
        event: {
          select: {
            name: true,
            venue: true,
            startsAt: true,
            organiser: { select: { name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.shopMember.findMany({
      where: { status: "PENDING", OR: identity },
      include: {
        shop: { select: { name: true, owner: { select: { name: true, email: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const total = eventInvites.length + shopInvites.length;

  return (
    <div className="pb-16">
      <TopBar title="Invitations" backHref="/dashboard" />

      <div className="px-4 pt-4 lg:px-6">
        {total === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="mb-2 text-3xl" aria-hidden>
              📭
            </div>
            <p className="font-display text-[16px] font-bold">No invitations</p>
            <p className="mx-auto mt-1 max-w-[280px] text-[13px] text-mute">
              When an organiser or vendor adds you to their team, it shows up here.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {eventInvites.map((invite) => (
              <li
                key={invite.id}
                className="rounded-3xl border-[1.5px] border-marigold bg-white p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-display text-[15px] font-bold leading-tight">
                      {invite.event.name}
                    </div>
                    <div className="text-[12px] text-mute">
                      {invite.event.startsAt.toLocaleDateString("en-NG", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}{" "}
                      · {invite.event.venue.split(",")[0]}
                    </div>
                  </div>
                  <Chip tone="gold">
                    {invite.role === "COHOST" ? "Cohost" : "Door staff"}
                  </Chip>
                </div>

                <p className="mt-2 text-[13px] text-mute">
                  {invite.event.organiser.name ?? invite.event.organiser.email} wants you
                  to help run this event.
                </p>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {invite.canCheckIn && <Chip tone="plum">Check guests in</Chip>}
                  {invite.canEditEvent && <Chip tone="plum">Edit event</Chip>}
                  {invite.canManageShops && <Chip tone="plum">Manage shops</Chip>}
                  {invite.canRefund && <Chip tone="flame">Issue refunds</Chip>}
                </div>

                {invite.earns && (
                  <div className="mt-2 rounded-xl bg-[#E3F0E7] px-3 py-2 text-[13px] text-[#1F6F44]">
                    You earn{" "}
                    <b>
                      {invite.shareType === "PERCENT"
                        ? `${(invite.shareBps ?? 0) / 100}%`
                        : formatNaira(invite.shareFlatKobo ?? 0)}
                    </b>{" "}
                    of{" "}
                    {invite.revenueLine === "TICKET_SALES"
                      ? "ticket revenue"
                      : invite.revenueLine === "SHOP_SHARE"
                        ? "the organiser's shop share"
                        : "sponsorship"}
                    .
                  </div>
                )}

                <div className="mt-3">
                  <RespondToInvite memberId={invite.id} kind="event" />
                </div>
              </li>
            ))}

            {shopInvites.map((invite) => (
              <li
                key={invite.id}
                className="rounded-3xl border-[1.5px] border-line bg-white p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-display text-[15px] font-bold">
                      {invite.shop.name}
                    </div>
                    <p className="mt-1 text-[13px] text-mute">
                      {invite.shop.owner.name ?? invite.shop.owner.email} wants you to
                      work this shop.
                    </p>
                  </div>
                  <Chip tone="line">Shop staff</Chip>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {invite.canCreateOrders && <Chip tone="plum">Take orders</Chip>}
                  {invite.canFulfilOrders && <Chip tone="plum">Fulfil orders</Chip>}
                  {invite.canEditProducts && <Chip tone="plum">Edit products</Chip>}
                  {invite.canRefund && <Chip tone="flame">Issue refunds</Chip>}
                </div>

                <div className="mt-3">
                  <RespondToInvite memberId={invite.id} kind="shop" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
