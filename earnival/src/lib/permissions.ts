import type { Prisma } from "@prisma/client";

import { db } from "./db";

/**
 * Who is allowed to do what.
 *
 * Ownership alone is not enough for a real event: the organiser cannot be the
 * only person who can check guests in, and a vendor cannot be the only person
 * who can serve a counter. Every capability resolves to "owner, or an accepted
 * member with that capability mapped".
 *
 * All checks fail closed — an unknown event, a revoked member or a pending
 * invitation grants nothing.
 */

export class PermissionError extends Error {}

export type EventCapability =
  | "checkIn"
  | "editEvent"
  | "manageShops"
  | "refund";

export type ShopCapability =
  | "createOrders"
  | "fulfilOrders"
  | "editProducts"
  | "refund";

const EVENT_COLUMN: Record<EventCapability, keyof Prisma.EventMemberWhereInput> = {
  checkIn: "canCheckIn",
  editEvent: "canEditEvent",
  manageShops: "canManageShops",
  refund: "canRefund",
};

const SHOP_COLUMN: Record<ShopCapability, keyof Prisma.ShopMemberWhereInput> = {
  createOrders: "canCreateOrders",
  fulfilOrders: "canFulfilOrders",
  editProducts: "canEditProducts",
  refund: "canRefund",
};

export interface EventAccess {
  allowed: boolean;
  isOwner: boolean;
  /** Present when access comes from a membership rather than ownership. */
  memberId?: string;
}

export async function eventAccess(params: {
  userId: string;
  eventId: string;
  capability: EventCapability;
}): Promise<EventAccess> {
  const { userId, eventId, capability } = params;

  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { organiserId: true },
  });
  if (!event) return { allowed: false, isOwner: false };
  if (event.organiserId === userId) return { allowed: true, isOwner: true };

  const member = await db.eventMember.findFirst({
    where: {
      eventId,
      userId,
      status: "ACCEPTED",
      [EVENT_COLUMN[capability]]: true,
    },
    select: { id: true },
  });

  return member
    ? { allowed: true, isOwner: false, memberId: member.id }
    : { allowed: false, isOwner: false };
}

export async function assertEventAccess(params: {
  userId: string;
  eventId: string;
  capability: EventCapability;
  message?: string;
}): Promise<EventAccess> {
  const access = await eventAccess(params);
  if (!access.allowed) {
    throw new PermissionError(params.message ?? "You don't have access to that event");
  }
  return access;
}

export interface ShopAccess {
  allowed: boolean;
  isOwner: boolean;
  memberId?: string;
}

export async function shopAccess(params: {
  userId: string;
  shopId: string;
  capability: ShopCapability;
}): Promise<ShopAccess> {
  const { userId, shopId, capability } = params;

  const shop = await db.shop.findUnique({
    where: { id: shopId },
    select: { ownerId: true },
  });
  if (!shop) return { allowed: false, isOwner: false };
  if (shop.ownerId === userId) return { allowed: true, isOwner: true };

  const member = await db.shopMember.findFirst({
    where: {
      shopId,
      userId,
      status: "ACCEPTED",
      [SHOP_COLUMN[capability]]: true,
    },
    select: { id: true },
  });

  return member
    ? { allowed: true, isOwner: false, memberId: member.id }
    : { allowed: false, isOwner: false };
}

export async function assertShopAccess(params: {
  userId: string;
  shopId: string;
  capability: ShopCapability;
  message?: string;
}): Promise<ShopAccess> {
  const access = await shopAccess(params);
  if (!access.allowed) {
    throw new PermissionError(params.message ?? "You don't have access to that shop");
  }
  return access;
}

/** Events this user can work, whether they own them or were invited. */
export async function eventsUserCanWork(userId: string) {
  const [owned, member] = await Promise.all([
    db.event.findMany({
      where: { organiserId: userId },
      select: { id: true },
    }),
    db.eventMember.findMany({
      where: { userId, status: "ACCEPTED" },
      select: { eventId: true },
    }),
  ]);
  return [...new Set([...owned.map((e) => e.id), ...member.map((m) => m.eventId)])];
}

/**
 * Binds invitations addressed to an email onto the account that just proved it
 * controls that address — the same idea as attaching guest purchases.
 */
export async function attachPendingInvitations(
  userId: string,
  email: string,
): Promise<void> {
  const normalised = email.trim().toLowerCase();
  await db.$transaction([
    db.eventMember.updateMany({
      where: { inviteEmail: normalised, userId: null },
      data: { userId },
    }),
    db.shopMember.updateMany({
      where: { inviteEmail: normalised, userId: null },
      data: { userId },
    }),
  ]);
}
