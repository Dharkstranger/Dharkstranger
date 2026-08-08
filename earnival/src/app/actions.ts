"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { generateSku, slugify, uniqueSlug } from "@/lib/ids";
import { nairaToKobo } from "@/lib/money";

export interface ActionState {
  error?: string;
  ok?: boolean;
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

  const event = await db.event.create({
    data: {
      slug,
      name: data.name,
      category: data.category,
      venue: data.venue,
      description: data.description ?? null,
      organiserNote: data.organiserNote ?? null,
      startsAt,
      organiserId: user.id,
      status: "LIVE",
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
