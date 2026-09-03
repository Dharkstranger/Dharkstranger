import { ImageResponse } from "next/og";

import { db } from "@/lib/db";
import { getImage, idFromUrl } from "@/lib/media";

export const runtime = "nodejs";
export const alt = "Event on Earnival";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The card people actually see when a link lands in a WhatsApp group.
 *
 * The PRD names distribution through WhatsApp, Instagram and X as a strategy
 * pillar; a link that unfurls to a blank rectangle is a link nobody taps. This
 * renders the event's own banner where one exists and a branded fallback where
 * it doesn't, so every share looks deliberate.
 *
 * Two Satori constraints shape the markup below:
 *   - every element with more than one child needs an explicit `display`, and
 *   - only glyphs in the bundled font render, so amounts are written "NGN
 *     15,000" rather than with ₦, which would need a font fetched at runtime.
 */
export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}) {
  const { slug } = await params;

  const event = await db.event.findUnique({
    where: { slug },
    select: {
      name: true,
      venue: true,
      startsAt: true,
      bannerUrl: true,
      organiser: { select: { verificationBadge: true } },
      ticketTypes: { where: { active: true }, select: { priceKobo: true } },
    },
  });

  if (!event) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#1C1030",
            color: "#fff",
            fontSize: 64,
            fontWeight: 800,
          }}
        >
          earnival
        </div>
      ),
      size,
    );
  }

  // Read the banner straight from storage rather than round-tripping over HTTP.
  let bannerDataUrl: string | null = null;
  const bannerId = idFromUrl(event.bannerUrl);
  if (bannerId) {
    const asset = await getImage(bannerId);
    if (asset) {
      bannerDataUrl = `data:${asset.contentType};base64,${Buffer.from(
        asset.bytes,
      ).toString("base64")}`;
    }
  }

  const when = event.startsAt.toLocaleDateString("en-NG", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const cheapest = event.ticketTypes.length
    ? Math.min(...event.ticketTypes.map((t) => t.priceKobo))
    : null;

  const priceLabel =
    cheapest === null
      ? null
      : cheapest === 0
        ? "Free entry"
        : `Tickets from NGN ${Math.floor(cheapest / 100).toLocaleString("en-NG")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#1C1030",
          // Satori resolves gradients through backgroundImage on an element
          // with explicit dimensions; the `background` shorthand on an
          // inset-positioned child silently renders as nothing.
          backgroundImage: bannerDataUrl
            ? undefined
            : "linear-gradient(135deg, #1C1030 0%, #3A1D63 38%, #5B2A9E 68%, #FF5E1A 130%)",
          position: "relative",
          fontFamily: "sans-serif",
        }}
      >
        {bannerDataUrl ? (
          <img
            src={bannerDataUrl}
            alt=""
            width={size.width}
            height={size.height}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : null}

        {/* Scrim so text stays readable over a photograph. Skipped without one:
            it would otherwise flatten the brand gradient into a dark slab. */}
        {bannerDataUrl && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: size.width,
              height: size.height,
              display: "flex",
              backgroundImage:
                "linear-gradient(180deg, rgba(28,16,48,0.25) 0%, rgba(28,16,48,0.92) 70%)",
            }}
          />
        )}

        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            height: "100%",
            padding: 64,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ display: "flex", fontSize: 34, fontWeight: 800, color: "#fff" }}>
              earnival
            </div>
            {event.organiser.verificationBadge && (
              <div
                style={{
                  display: "flex",
                  background: "#1F6F44",
                  color: "#fff",
                  fontSize: 20,
                  fontWeight: 700,
                  padding: "6px 14px",
                  borderRadius: 999,
                }}
              >
                Verified organiser
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                fontSize: 68,
                fontWeight: 800,
                color: "#fff",
                lineHeight: 1.05,
                letterSpacing: -1.5,
                maxHeight: 232,
                overflow: "hidden",
              }}
            >
              {event.name}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 20,
                marginTop: 26,
                fontSize: 30,
                color: "#E9E2D6",
              }}
            >
              <div style={{ display: "flex" }}>{when}</div>
              <div style={{ display: "flex", color: "#9C93A8" }}>|</div>
              <div style={{ display: "flex" }}>{event.venue.split(",")[0]}</div>
            </div>

            {priceLabel && (
              <div style={{ display: "flex", marginTop: 26 }}>
                <div
                  style={{
                    display: "flex",
                    background: "#FFB020",
                    color: "#1C1030",
                    fontSize: 28,
                    fontWeight: 800,
                    padding: "10px 22px",
                    borderRadius: 999,
                  }}
                >
                  {priceLabel}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
