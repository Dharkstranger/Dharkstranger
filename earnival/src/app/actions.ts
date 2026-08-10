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
import { PermissionError, assertEventAccess, assertShopAccess } from "@/lib/permissions";
import { sendEmail } from "@/lib/mail";
import { recordConsent } from "@/lib/legal";

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

const updateEventSchema = z.object({
  eventId: z.string().min(1),
  name: z.string().trim().min(3, "Give your event a name"),
  venue: z.string().trim().min(3, "Where is it happening?"),
  date: z.string().min(1, "Pick a date"),
  time: z.string().min(1, "Pick a start time"),
  description: z.string().trim().max(2000).optional(),
  organiserNote: z.string().trim().max(500).optional(),
  bannerUrl: z
    .string()
    .regex(/^\/api\/media\/[A-Za-z0-9_-]+$/)
    .optional()
    .or(z.literal("")),
  notifyAttendees: z.boolean(),
  notifyMessage: z.string().trim().max(500).optional(),
});

/**
 * Edits a published event.
 *
 * Without this an organiser cannot fix a misspelled venue or move the start
 * time — they would have to delete and rebuild, losing every ticket sold.
 * PRD EVT-14 also requires prompting to tell attendees what changed.
 */
export async function updateEventAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = updateEventSchema.safeParse({
    eventId: formData.get("eventId"),
    name: formData.get("name"),
    venue: formData.get("venue"),
    date: formData.get("date"),
    time: formData.get("time"),
    description: formData.get("description") || undefined,
    organiserNote: formData.get("organiserNote") || undefined,
    bannerUrl: formData.get("bannerUrl") || undefined,
    notifyAttendees: formData.get("notifyAttendees") === "on",
    notifyMessage: formData.get("notifyMessage") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  }
  const data = parsed.data;

  try {
    await assertEventAccess({
      userId: user.id,
      eventId: data.eventId,
      capability: "editEvent",
    });
  } catch (error) {
    return { error: error instanceof PermissionError ? error.message : "Not allowed" };
  }

  const existing = await db.event.findUniqueOrThrow({
    where: { id: data.eventId },
    select: { startsAt: true, venue: true, name: true, slug: true },
  });

  const startsAt = new Date(`${data.date}T${data.time}:00`);
  if (Number.isNaN(startsAt.getTime())) return { error: "That date isn't valid" };

  await db.event.update({
    where: { id: data.eventId },
    data: {
      name: data.name,
      venue: data.venue,
      startsAt,
      description: data.description ?? null,
      organiserNote: data.organiserNote ?? null,
      bannerUrl: data.bannerUrl || null,
    },
  });

  if (data.notifyAttendees) {
    const changes: string[] = [];
    if (existing.name !== data.name) changes.push(`Name is now "${data.name}"`);
    if (existing.venue !== data.venue) changes.push(`Venue is now ${data.venue}`);
    if (existing.startsAt.getTime() !== startsAt.getTime()) {
      changes.push(
        `Starts ${startsAt.toLocaleString("en-NG", {
          dateStyle: "full",
          timeStyle: "short",
        })}`,
      );
    }
    await notifyAttendeesOfChange(data.eventId, data.notifyMessage, changes);
  }

  revalidatePath(`/dashboard/events/${data.eventId}`);
  revalidatePath(`/e/${existing.slug}`);
  revalidatePath("/");
  return { ok: true, message: "Saved" };
}

async function notifyAttendeesOfChange(
  eventId: string,
  message: string | undefined,
  changes: string[],
): Promise<void> {
  const event = await db.event.findUniqueOrThrow({
    where: { id: eventId },
    select: { name: true, slug: true, venue: true, startsAt: true },
  });

  const holders = await db.ticket.findMany({
    where: { eventId, status: { in: ["VALID", "CHECKED_IN"] } },
    select: { attendeeEmail: true, attendeeName: true },
  });

  // One email per address, not per ticket.
  const unique = new Map(holders.map((h) => [h.attendeeEmail, h.attendeeName]));
  const base = process.env.APP_URL || "http://localhost:3000";

  for (const [email, name] of unique) {
    await sendEmail({
      to: email,
      subject: `Update: ${event.name}`,
      text: [
        `Hi ${name},`,
        ``,
        `There's an update to ${event.name}.`,
        message ? `\n${message}\n` : "",
        ...changes,
        ``,
        `${event.venue}`,
        `${event.startsAt.toLocaleString("en-NG", { dateStyle: "full", timeStyle: "short" })}`,
        ``,
        `Full details: ${base}/e/${event.slug}`,
      ]
        .filter(Boolean)
        .join("\n"),
      html: `
        <p>Hi ${name},</p>
        <p>There's an update to <b>${event.name}</b>.</p>
        ${message ? `<p>${message}</p>` : ""}
        ${changes.length ? `<ul>${changes.map((c) => `<li>${c}</li>`).join("")}</ul>` : ""}
        <p><a href="${base}/e/${event.slug}">See the full details</a></p>`,
    }).catch(() => {});
  }
}

const ticketTypeSchema = z.object({
  eventId: z.string().min(1),
  ticketTypeId: z.string().optional(),
  name: z.string().trim().min(1, "Name the ticket"),
  price: z.coerce.number().min(0),
  quantity: z.coerce.number().int().min(1),
  active: z.boolean(),
});

/** Adds or edits a ticket type without invalidating tickets already sold. */
export async function saveTicketTypeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = ticketTypeSchema.safeParse({
    eventId: formData.get("eventId"),
    ticketTypeId: formData.get("ticketTypeId") || undefined,
    name: formData.get("name"),
    price: formData.get("price"),
    quantity: formData.get("quantity"),
    active: formData.get("active") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  }
  const data = parsed.data;

  try {
    await assertEventAccess({
      userId: user.id,
      eventId: data.eventId,
      capability: "editEvent",
    });
  } catch {
    return { error: "Not allowed" };
  }

  if (data.ticketTypeId) {
    const type = await db.ticketType.findUnique({
      where: { id: data.ticketTypeId },
      select: { eventId: true, sold: true, reserved: true, priceKobo: true },
    });
    if (!type || type.eventId !== data.eventId) return { error: "Ticket not found" };

    // Capacity can never drop below what has already gone out of the door.
    const committed = type.sold + type.reserved;
    if (data.quantity < committed) {
      return {
        error: `${committed} already sold or held — capacity can't go below that`,
      };
    }

    await db.ticketType.update({
      where: { id: data.ticketTypeId },
      data: {
        name: data.name,
        // Repricing applies to future sales only; tickets already issued keep
        // the price they were bought at, which is stored on the ticket.
        priceKobo: nairaToKobo(data.price),
        quantity: data.quantity,
        active: data.active,
      },
    });
  } else {
    const count = await db.ticketType.count({ where: { eventId: data.eventId } });
    await db.ticketType.create({
      data: {
        eventId: data.eventId,
        name: data.name,
        priceKobo: nairaToKobo(data.price),
        quantity: data.quantity,
        active: data.active,
        sortOrder: count,
      },
    });
  }

  const event = await db.event.findUniqueOrThrow({
    where: { id: data.eventId },
    select: { slug: true },
  });
  revalidatePath(`/dashboard/events/${data.eventId}/edit`);
  revalidatePath(`/e/${event.slug}`);
  return { ok: true, message: "Saved" };
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

const updateProductSchema = z.object({
  productId: z.string().min(1),
  name: z.string().trim().min(1, "Name the product"),
  price: z.coerce.number().min(0),
  stock: z.coerce.number().int().min(0),
  emoji: z.string().trim().max(8).optional(),
  imageUrl: z
    .string()
    .regex(/^\/api\/media\/[A-Za-z0-9_-]+$/)
    .optional()
    .or(z.literal("")),
  active: z.boolean(),
  lowStockThreshold: z.coerce.number().int().min(0).max(1000),
});

export async function updateProductAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = updateProductSchema.safeParse({
    productId: formData.get("productId"),
    name: formData.get("name"),
    price: formData.get("price"),
    stock: formData.get("stock"),
    emoji: formData.get("emoji") || undefined,
    imageUrl: formData.get("imageUrl") || undefined,
    active: formData.get("active") === "on",
    lowStockThreshold: formData.get("lowStockThreshold") || 1,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  }
  const data = parsed.data;

  const product = await db.product.findUnique({
    where: { id: data.productId },
    select: { shopId: true, reserved: true, shop: { select: { slug: true } } },
  });
  if (!product) return { error: "Product not found" };

  try {
    await assertShopAccess({
      userId: user.id,
      shopId: product.shopId,
      capability: "editProducts",
    });
  } catch (error) {
    return { error: error instanceof PermissionError ? error.message : "Not allowed" };
  }

  // Stock can't fall below what in-flight checkouts are already holding.
  if (data.stock < product.reserved) {
    return {
      error: `${product.reserved} are held by checkouts in progress — stock can't go below that`,
    };
  }

  await db.product.update({
    where: { id: data.productId },
    data: {
      name: data.name,
      priceKobo: nairaToKobo(data.price),
      stock: data.stock,
      emoji: data.emoji || null,
      imageUrl: data.imageUrl || null,
      active: data.active,
      lowStockThreshold: data.lowStockThreshold,
    },
  });

  revalidatePath("/shop");
  revalidatePath(`/s/${product.shop.slug}`);
  return { ok: true, message: "Saved" };
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

  // NDPR: processing an identity document needs demonstrable consent.
  if (formData.get("kycConsent") !== "on") {
    return { error: "Please confirm you agree to us processing your ID" };
  }
  await recordConsent({
    email: user.email,
    userId: user.id,
    kinds: ["KYC_PROCESSING"],
  }).catch(() => {});

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
/* Team — cohosts and shop staff                                       */
/* ------------------------------------------------------------------ */

const inviteSchema = z.object({
  eventId: z.string().min(1),
  email: z.string().trim().email("Enter a valid email"),
  role: z.enum(["COHOST", "DOOR_STAFF"]),
  canCheckIn: z.boolean(),
  canEditEvent: z.boolean(),
  canManageShops: z.boolean(),
  canRefund: z.boolean(),
  earns: z.boolean(),
  shareType: z.enum(["NONE", "FLAT", "PERCENT"]),
  sharePct: z.coerce.number().min(0).max(100).optional(),
  shareFlatNaira: z.coerce.number().min(0).optional(),
  revenueLine: z.enum(["TICKET_SALES", "SHOP_SHARE", "SPONSOR"]),
});

export async function inviteEventMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = inviteSchema.safeParse({
    eventId: formData.get("eventId"),
    email: formData.get("email"),
    role: formData.get("role") || "DOOR_STAFF",
    canCheckIn: formData.get("canCheckIn") === "on",
    canEditEvent: formData.get("canEditEvent") === "on",
    canManageShops: formData.get("canManageShops") === "on",
    canRefund: formData.get("canRefund") === "on",
    earns: formData.get("earns") === "on",
    shareType: formData.get("shareType") || "NONE",
    sharePct: formData.get("sharePct") || undefined,
    shareFlatNaira: formData.get("shareFlatNaira") || undefined,
    revenueLine: formData.get("revenueLine") || "TICKET_SALES",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  }
  const data = parsed.data;

  try {
    await assertEventAccess({
      userId: user.id,
      eventId: data.eventId,
      capability: "editEvent",
      message: "Only the organiser can change the team",
    });
  } catch (error) {
    return { error: error instanceof PermissionError ? error.message : "Not allowed" };
  }

  const email = data.email.toLowerCase();
  const event = await db.event.findUniqueOrThrow({
    where: { id: data.eventId },
    select: { name: true, slug: true, organiser: { select: { email: true, name: true } } },
  });

  if (email === event.organiser.email) {
    return { error: "You already own this event" };
  }

  const existing = await db.eventMember.findUnique({
    where: { eventId_inviteEmail: { eventId: data.eventId, inviteEmail: email } },
  });
  if (existing && existing.status !== "REVOKED") {
    return { error: "That person has already been invited" };
  }

  const invitee = await db.user.findUnique({ where: { email }, select: { id: true } });

  const payload = {
    role: data.role,
    status: "PENDING" as const,
    canCheckIn: data.canCheckIn,
    canEditEvent: data.canEditEvent,
    canManageShops: data.canManageShops,
    canRefund: data.canRefund,
    earns: data.earns,
    shareType: data.earns ? data.shareType : ("NONE" as const),
    shareBps:
      data.earns && data.shareType === "PERCENT"
        ? Math.round((data.sharePct ?? 0) * 100)
        : null,
    shareFlatKobo:
      data.earns && data.shareType === "FLAT"
        ? nairaToKobo(data.shareFlatNaira ?? 0)
        : null,
    revenueLine: data.revenueLine,
    userId: invitee?.id ?? null,
    invitedById: user.id,
    respondedAt: null,
  };

  if (existing) {
    await db.eventMember.update({ where: { id: existing.id }, data: payload });
  } else {
    await db.eventMember.create({
      data: { eventId: data.eventId, inviteEmail: email, ...payload },
    });
  }

  const base = process.env.APP_URL || "http://localhost:3000";
  await sendEmail({
    to: email,
    subject: `${event.organiser.name ?? "An organiser"} added you to ${event.name}`,
    text: [
      `You've been invited to help run ${event.name} on Earnival.`,
      data.canCheckIn ? "You can check guests in at the gate." : "",
      "",
      `Accept here: ${base}/dashboard/invitations`,
    ]
      .filter(Boolean)
      .join("\n"),
    html: `<p>You've been invited to help run <b>${event.name}</b> on Earnival.</p>
      ${data.canCheckIn ? "<p>You'll be able to check guests in at the gate.</p>" : ""}
      <p><a href="${base}/dashboard/invitations">Accept the invitation</a></p>`,
  }).catch(() => {});

  revalidatePath(`/dashboard/events/${data.eventId}/team`);
  return { ok: true, message: `Invitation sent to ${email}` };
}

export async function respondToEventInviteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const memberId = String(formData.get("memberId") ?? "");
  const accept = String(formData.get("decision") ?? "") === "accept";

  const member = await db.eventMember.findUnique({ where: { id: memberId } });
  if (!member) return { error: "Invitation not found" };
  // Bind by email as well as user id: the row may predate their account.
  if (member.userId !== user.id && member.inviteEmail !== user.email) {
    return { error: "That invitation isn't for you" };
  }
  if (member.status !== "PENDING") return { error: "Already responded" };

  await db.eventMember.update({
    where: { id: memberId },
    data: {
      status: accept ? "ACCEPTED" : "REJECTED",
      userId: user.id,
      respondedAt: new Date(),
    },
  });

  revalidatePath("/dashboard/invitations");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function revokeEventMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const memberId = String(formData.get("memberId") ?? "");

  const member = await db.eventMember.findUnique({ where: { id: memberId } });
  if (!member) return { error: "Not found" };

  try {
    await assertEventAccess({
      userId: user.id,
      eventId: member.eventId,
      capability: "editEvent",
    });
  } catch {
    return { error: "Not allowed" };
  }

  // Revoked rather than deleted: any revenue already credited must stay
  // attributable in the ledger.
  await db.eventMember.update({
    where: { id: memberId },
    data: { status: "REVOKED" },
  });

  revalidatePath(`/dashboard/events/${member.eventId}/team`);
  return { ok: true };
}

const shopInviteSchema = z.object({
  shopId: z.string().min(1),
  email: z.string().trim().email("Enter a valid email"),
  canCreateOrders: z.boolean(),
  canFulfilOrders: z.boolean(),
  canEditProducts: z.boolean(),
  canRefund: z.boolean(),
});

export async function inviteShopMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = shopInviteSchema.safeParse({
    shopId: formData.get("shopId"),
    email: formData.get("email"),
    canCreateOrders: formData.get("canCreateOrders") === "on",
    canFulfilOrders: formData.get("canFulfilOrders") === "on",
    canEditProducts: formData.get("canEditProducts") === "on",
    canRefund: formData.get("canRefund") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  }

  const shop = await db.shop.findUnique({
    where: { id: parsed.data.shopId },
    select: { ownerId: true, name: true },
  });
  if (!shop || shop.ownerId !== user.id) {
    return { error: "Only the shop owner can add staff" };
  }

  const email = parsed.data.email.toLowerCase();
  const invitee = await db.user.findUnique({ where: { email }, select: { id: true } });

  const existing = await db.shopMember.findUnique({
    where: { shopId_inviteEmail: { shopId: parsed.data.shopId, inviteEmail: email } },
  });
  if (existing && existing.status !== "REVOKED") {
    return { error: "That person has already been invited" };
  }

  const payload = {
    status: "PENDING" as const,
    canCreateOrders: parsed.data.canCreateOrders,
    canFulfilOrders: parsed.data.canFulfilOrders,
    canEditProducts: parsed.data.canEditProducts,
    canRefund: parsed.data.canRefund,
    userId: invitee?.id ?? null,
    invitedById: user.id,
    respondedAt: null,
  };

  if (existing) {
    await db.shopMember.update({ where: { id: existing.id }, data: payload });
  } else {
    await db.shopMember.create({
      data: { shopId: parsed.data.shopId, inviteEmail: email, ...payload },
    });
  }

  const base = process.env.APP_URL || "http://localhost:3000";
  await sendEmail({
    to: email,
    subject: `You've been added to ${shop.name}`,
    text: `You've been invited to work at ${shop.name} on Earnival.\n\nAccept here: ${base}/dashboard/invitations`,
    html: `<p>You've been invited to work at <b>${shop.name}</b> on Earnival.</p><p><a href="${base}/dashboard/invitations">Accept the invitation</a></p>`,
  }).catch(() => {});

  revalidatePath("/shop/team");
  return { ok: true, message: `Invitation sent to ${email}` };
}

export async function respondToShopInviteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const memberId = String(formData.get("memberId") ?? "");
  const accept = String(formData.get("decision") ?? "") === "accept";

  const member = await db.shopMember.findUnique({ where: { id: memberId } });
  if (!member) return { error: "Invitation not found" };
  if (member.userId !== user.id && member.inviteEmail !== user.email) {
    return { error: "That invitation isn't for you" };
  }
  if (member.status !== "PENDING") return { error: "Already responded" };

  await db.shopMember.update({
    where: { id: memberId },
    data: {
      status: accept ? "ACCEPTED" : "REJECTED",
      userId: user.id,
      respondedAt: new Date(),
    },
  });

  revalidatePath("/dashboard/invitations");
  return { ok: true };
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

/**
 * Re-runs a webhook delivery that failed processing. The stored payload is
 * replayed through the same settle path, which is idempotent — so a replay
 * that turns out to have already succeeded is a no-op rather than a double
 * credit.
 */
export async function replayWebhookAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("webhookEventId") ?? "");

  const record = await db.webhookEvent.findUnique({ where: { id } });
  if (!record) return { error: "Not found" };

  const payload = record.payload as { data?: { reference?: string; id?: number } } | null;
  const reference = payload?.data?.reference;
  if (!reference) return { error: "That delivery has no reference to replay" };

  try {
    const { settlePayment, failPayment } = await import("@/lib/commerce");
    const { markTransferOutcome } = await import("@/lib/settlement");

    switch (record.eventType) {
      case "charge.success":
        await settlePayment(reference, payload?.data);
        break;
      case "charge.failed":
        await failPayment(reference);
        break;
      case "transfer.success":
        await markTransferOutcome(reference, "PAID");
        break;
      case "transfer.failed":
      case "transfer.reversed":
        await markTransferOutcome(reference, "FAILED", "Replayed after failure");
        break;
      default:
        return { error: `No replay handler for ${record.eventType}` };
    }

    await db.webhookEvent.update({
      where: { id },
      data: { processedAt: new Date(), error: null },
    });

    revalidatePath("/admin");
    return { ok: true, message: "Replayed successfully" };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Replay failed",
    };
  }
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
