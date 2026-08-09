"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { generateSku, slugify, uniqueSlug } from "@/lib/ids";
import { nairaToKobo } from "@/lib/money";
import {
  VerificationError,
  entitlementsFor,
  requestPhoneCode,
  submitBusiness,
  submitIdentity,
  verifyPhoneCode,
} from "@/lib/verification";
import { RefundError, cancelEventAndRefundAll, refundOrder, refundTickets } from "@/lib/refunds";
import { SettlementError, addPayoutAccount } from "@/lib/settlement";

export interface ActionState {
  error?: string;
  ok?: boolean;
  message?: string;
}

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */

const eventSchema = z.object({
  name: z.string().trim().min(3, "Give your event a name"),
  category: z.string().trim().min(1),
  venue: z.string().trim().min(3, "Where is it happening?"),
  date: z.string().min(1, "Pick a date"),
  time: z.string().min(1, "Pick a start time"),
  description: z.string().trim().max(2000).optional(),
  organiserNote: z.string().trim().max(500).optional(),
  // Only ever a path we generated ourselves — never an arbitrary remote URL.
  bannerUrl: z
    .string()
    .regex(/^\/api\/media\/[A-Za-z0-9_-]+$/, "That image didn't upload properly")
    .optional()
    .or(z.literal("")),
  ticketNames: z.array(z.string()),
  ticketPrices: z.array(z.string()),
  ticketQuantities: z.array(z.string()),
});

export async function createEventAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = eventSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    venue: formData.get("venue"),
    date: formData.get("date"),
    time: formData.get("time"),
    description: formData.get("description") || undefined,
    organiserNote: formData.get("organiserNote") || undefined,
    bannerUrl: formData.get("bannerUrl") || undefined,
    ticketNames: formData.getAll("ticketName").map(String),
    ticketPrices: formData.getAll("ticketPrice").map(String),
    ticketQuantities: formData.getAll("ticketQuantity").map(String),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  }
  const data = parsed.data;

  const startsAt = new Date(`${data.date}T${data.time}:00`);
  if (Number.isNaN(startsAt.getTime())) return { error: "That date isn't valid" };

  const tickets = data.ticketNames
    .map((name, i) => ({
      name: name.trim(),
      priceNaira: Number(data.ticketPrices[i] ?? 0),
      quantity: Number(data.ticketQuantities[i] ?? 0),
      sortOrder: i,
    }))
    .filter((t) => t.name.length > 0);

  if (tickets.length === 0) return { error: "Add at least one ticket type" };
  if (tickets.some((t) => !Number.isFinite(t.priceNaira) || t.priceNaira < 0)) {
    return { error: "Ticket prices must be zero or more" };
  }
  if (tickets.some((t) => !Number.isInteger(t.quantity) || t.quantity < 1)) {
    return { error: "Each ticket type needs a quantity of at least 1" };
  }

  const slug = await uniqueSlug(
    slugify(data.name),
    async (candidate) =>
      (await db.event.count({ where: { slug: candidate } })) > 0,
  );

  // PRD VRF-01: an L0 organiser's PAID events go to the admin queue; free
  // events publish immediately. L1+ auto-approves everything.
  const entitlements = entitlementsFor(user.verificationLevel);
  const isPaid = tickets.some((t) => t.priceNaira > 0);
  const needsReview =
    isPaid && entitlements.autoApproval === "FREE_EVENTS_ONLY";

  const event = await db.event.create({
    data: {
      slug,
      name: data.name,
      category: data.category,
      venue: data.venue,
      description: data.description ?? null,
      organiserNote: data.organiserNote ?? null,
      bannerUrl: data.bannerUrl || null,
      startsAt,
      organiserId: user.id,
      status: "LIVE",
      approvalStatus: needsReview ? "PENDING_REVIEW" : "AUTO_APPROVED",
      // Cap is snapshot at publish, so a later level change cannot invalidate
      // sales already made under the old limit.
      revenueCapKobo: entitlements.revenueCapKobo,
      publishedAt: new Date(),
      ticketTypes: {
        create: tickets.map((t) => ({
          name: t.name,
          priceKobo: nairaToKobo(t.priceNaira),
          quantity: t.quantity,
          sortOrder: t.sortOrder,
        })),
      },
    },
  });

  revalidatePath("/");
  revalidatePath("/dashboard");
  redirect(`/dashboard/events/${event.id}?created=1`);
}

/* ------------------------------------------------------------------ */
/* Shops                                                               */
/* ------------------------------------------------------------------ */

const shopSchema = z.object({
  name: z.string().trim().min(2, "Give your shop a name"),
  category: z.string().trim().min(1),
  description: z.string().trim().max(1000).optional(),
  whatsapp: z.string().trim().max(30).optional(),
  payAtEvent: z.boolean(),
});

export async function createShopAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = shopSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    description: formData.get("description") || undefined,
    whatsapp: formData.get("whatsapp") || undefined,
    payAtEvent: formData.get("payAtEvent") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  }

  // PRD VRF-01/02: shop creation needs a verified phone (L1+).
  if (!entitlementsFor(user.verificationLevel).canCreateShop) {
    return {
      error:
        "Verify your phone number to open a shop. It takes about a minute — head to Verification.",
    };
  }

  const existing = await db.shop.count({ where: { ownerId: user.id } });
  // PRD PLN-01: the Starter plan allows one shop.
  if (existing >= 1) {
    return { error: "Your plan includes one shop. Upgrade to open another." };
  }

  const slug = await uniqueSlug(
    slugify(parsed.data.name),
    async (candidate) => (await db.shop.count({ where: { slug: candidate } })) > 0,
  );

  await db.shop.create({
    data: {
      slug,
      name: parsed.data.name,
      category: parsed.data.category,
      description: parsed.data.description ?? null,
      whatsapp: parsed.data.whatsapp ?? null,
      payAtEvent: parsed.data.payAtEvent,
      ownerId: user.id,
      status: "DRAFT",
    },
  });

  revalidatePath("/shop");
  return { ok: true };
}

const productSchema = z.object({
  shopId: z.string().min(1),
  name: z.string().trim().min(1, "Name the product"),
  price: z.coerce.number().min(0, "Price must be zero or more"),
  stock: z.coerce.number().int().min(0, "Stock must be a whole number"),
  emoji: z.string().trim().max(8).optional(),
  imageUrl: z
    .string()
    .regex(/^\/api\/media\/[A-Za-z0-9_-]+$/)
    .optional()
    .or(z.literal("")),
});

export async function addProductAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = productSchema.safeParse({
    shopId: formData.get("shopId"),
    name: formData.get("name"),
    price: formData.get("price"),
    stock: formData.get("stock"),
    emoji: formData.get("emoji") || undefined,
    imageUrl: formData.get("imageUrl") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  }

  const shop = await db.shop.findUnique({
    where: { id: parsed.data.shopId },
    include: { _count: { select: { products: true } } },
  });
  if (!shop || shop.ownerId !== user.id) return { error: "Shop not found" };

  await db.product.create({
    data: {
      shopId: shop.id,
      name: parsed.data.name,
      priceKobo: nairaToKobo(parsed.data.price),
      stock: parsed.data.stock,
      emoji: parsed.data.emoji || null,
      imageUrl: parsed.data.imageUrl || null,
      sku: generateSku(shop.name, shop._count.products + 1),
    },
  });

  // PRD SHP-06: a shop leaves draft once it has its first product.
  if (shop.status === "DRAFT") {
    await db.shop.update({ where: { id: shop.id }, data: { status: "ACTIVE" } });
  }

  revalidatePath("/shop");
  revalidatePath(`/s/${shop.slug}`);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Connections                                                         */
/* ------------------------------------------------------------------ */

export async function requestConnectionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const shopId = String(formData.get("shopId") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  const sharePct = Number(formData.get("sharePct") ?? 5);

  if (!Number.isFinite(sharePct) || sharePct < 0 || sharePct > 50) {
    return { error: "Offer a share between 0% and 50%" };
  }

  if (!entitlementsFor(user.verificationLevel).canConnectShop) {
    return { error: "Verify your phone number before connecting to events." };
  }

  const [shop, event] = await Promise.all([
    db.shop.findUnique({ where: { id: shopId } }),
    db.event.findUnique({ where: { id: eventId } }),
  ]);

  if (!shop || shop.ownerId !== user.id) return { error: "Shop not found" };
  if (!event) return { error: "Event not found" };
  if (shop.status !== "ACTIVE") {
    return { error: "Add a product before connecting to events" };
  }

  const existing = await db.connection.findUnique({
    where: { shopId_eventId: { shopId, eventId } },
  });
  if (existing) return { error: "You've already requested this event" };

  await db.connection.create({
    data: {
      shopId,
      eventId,
      requestedBy: user.id,
      revenueShareBps: Math.round(sharePct * 100),
      // The organiser's own event auto-accepts; everyone else waits for review.
      status: event.organiserId === user.id ? "ACTIVE" : "PENDING",
      respondedAt: event.organiserId === user.id ? new Date() : null,
    },
  });

  revalidatePath("/shop");
  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true };
}

export async function respondToConnectionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const connectionId = String(formData.get("connectionId") ?? "");
  const decision = String(formData.get("decision") ?? "");

  const connection = await db.connection.findUnique({
    where: { id: connectionId },
    include: { event: true },
  });
  if (!connection) return { error: "Connection not found" };
  if (connection.event.organiserId !== user.id) {
    return { error: "You don't run this event" };
  }
  if (connection.status !== "PENDING") {
    return { error: "That request was already handled" };
  }

  await db.connection.update({
    where: { id: connectionId },
    data: {
      status: decision === "accept" ? "ACTIVE" : "REJECTED",
      respondedAt: new Date(),
      rejectionReason: decision === "accept" ? null : "Declined by organiser",
    },
  });

  revalidatePath(`/dashboard/events/${connection.eventId}`);
  revalidatePath(`/e/${connection.event.slug}`);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Session                                                             */
/* ------------------------------------------------------------------ */

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (name.length < 2) return { error: "Enter your full name" };

  await db.user.update({
    where: { id: user.id },
    data: { name, phone: phone || null },
  });

  revalidatePath("/dashboard");
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Verification                                                        */
/* ------------------------------------------------------------------ */

export async function requestPhoneCodeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  try {
    await requestPhoneCode(String(formData.get("phone") ?? ""));
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof VerificationError ? error.message : "Could not send a code",
    };
  }
}

export async function verifyPhoneCodeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  try {
    await verifyPhoneCode(
      user.id,
      String(formData.get("phone") ?? ""),
      String(formData.get("code") ?? ""),
    );
    revalidatePath("/verify");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof VerificationError ? error.message : "Could not verify",
    };
  }
}

export async function submitIdentityAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const kind = String(formData.get("kind") ?? "BVN");
  if (kind !== "BVN" && kind !== "NIN") return { error: "Choose BVN or NIN" };

  try {
    await submitIdentity({
      userId: user.id,
      kind,
      value: String(formData.get("value") ?? ""),
    });
    revalidatePath("/verify");
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof VerificationError ? error.message : "Could not submit",
    };
  }
}

export async function submitBusinessAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  try {
    await submitBusiness({
      userId: user.id,
      businessName: String(formData.get("businessName") ?? ""),
      cacNumber: String(formData.get("cacNumber") ?? ""),
      tin: String(formData.get("tin") ?? ""),
    });
    revalidatePath("/verify");
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof VerificationError ? error.message : "Could not submit",
    };
  }
}

/* ------------------------------------------------------------------ */
/* Payout accounts                                                     */
/* ------------------------------------------------------------------ */

export async function addPayoutAccountAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const bankCode = String(formData.get("bankCode") ?? "");
  const bankName = String(formData.get("bankName") ?? "");

  try {
    const { accountName } = await addPayoutAccount({
      userId: user.id,
      bankCode,
      bankName,
      accountNumber: String(formData.get("accountNumber") ?? ""),
    });
    revalidatePath("/payouts");
    return { ok: true, message: `Verified as ${accountName}` };
  } catch (error) {
    return {
      error:
        error instanceof SettlementError
          ? error.message
          : "Could not verify that account. Check the number and bank.",
    };
  }
}

/* ------------------------------------------------------------------ */
/* Refunds                                                             */
/* ------------------------------------------------------------------ */

export async function refundOrderAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const orderId = String(formData.get("orderId") ?? "");
  const partial = String(formData.get("partialNaira") ?? "").trim();

  try {
    await refundOrder({
      orderId,
      goodsKobo: partial ? nairaToKobo(Number(partial)) : undefined,
      reason: "BUYER_REQUEST",
      note: String(formData.get("note") ?? "") || undefined,
      actorUserId: user.id,
    });
    revalidatePath("/shop");
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof RefundError ? error.message : "Could not refund that order",
    };
  }
}

export async function refundTicketAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const ticketId = String(formData.get("ticketId") ?? "");

  try {
    await refundTickets({
      ticketIds: [ticketId],
      reason: "BUYER_REQUEST",
      actorUserId: user.id,
    });
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof RefundError ? error.message : "Could not refund that ticket",
    };
  }
}

export async function cancelEventAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const eventId = String(formData.get("eventId") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (confirm !== "CANCEL") {
    return { error: 'Type CANCEL to confirm — this refunds every ticket and order.' };
  }

  try {
    const result = await cancelEventAndRefundAll({
      eventId,
      actorUserId: user.id,
      note: String(formData.get("note") ?? "") || undefined,
    });
    revalidatePath(`/dashboard/events/${eventId}`);
    return {
      ok: true,
      message: `Cancelled. Refunded ${result.ticketsRefunded} ticket(s) and ${result.ordersRefunded} order(s).${
        result.failures.length ? ` ${result.failures.length} need manual attention.` : ""
      }`,
    };
  } catch (error) {
    return {
      error: error instanceof RefundError ? error.message : "Could not cancel that event",
    };
  }
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

async function requireAdmin() {
  const user = await requireUser();
  if (!user.isAdmin) throw new Error("Not authorised");
  return user;
}

export async function reviewEventAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const eventId = String(formData.get("eventId") ?? "");
  const approve = String(formData.get("decision") ?? "") === "approve";

  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) return { error: "Event not found" };
  if (event.approvalStatus !== "PENDING_REVIEW") {
    return { error: "That event was already reviewed" };
  }

  await db.event.update({
    where: { id: eventId },
    data: {
      approvalStatus: approve ? "APPROVED" : "REJECTED",
      status: approve ? "LIVE" : "DRAFT",
      reviewedById: admin.id,
      reviewedAt: new Date(),
      rejectionReason: approve
        ? null
        : String(formData.get("reason") ?? "Did not meet our review standards"),
    },
  });

  revalidatePath("/admin");
  revalidatePath(`/e/${event.slug}`);
  return { ok: true };
}

export async function reviewVerificationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const { reviewSubmission } = await import("@/lib/verification");

  try {
    await reviewSubmission({
      submissionId: String(formData.get("submissionId") ?? ""),
      reviewerId: admin.id,
      approve: String(formData.get("decision") ?? "") === "approve",
      rejectionReason: String(formData.get("reason") ?? "") || undefined,
    });
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof VerificationError ? error.message : "Could not review",
    };
  }
}
