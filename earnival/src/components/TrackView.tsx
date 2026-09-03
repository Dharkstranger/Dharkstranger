"use client";

import { useEffect, useRef } from "react";

/**
 * Fires a single funnel beacon when a page is opened. Rendered from server
 * components so the page itself stays static-friendly.
 */
export function TrackView({
  name,
  eventId,
  shopId,
}: {
  name: string;
  eventId?: string;
  shopId?: string;
}) {
  const sent = useRef(false);

  useEffect(() => {
    // React 18 mounts twice in development; only one beacon should go out.
    if (sent.current) return;
    sent.current = true;

    void fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, eventId, shopId }),
      keepalive: true,
    }).catch(() => {});
  }, [name, eventId, shopId]);

  return null;
}
