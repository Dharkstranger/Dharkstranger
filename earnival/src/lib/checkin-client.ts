"use client";

/**
 * Offline-tolerant check-in (PRD OPS-05).
 *
 * Nigerian event venues routinely lose connectivity at exactly the moment a
 * queue of 500 people is waiting to get in. Every scan is therefore written to
 * a local queue first and flushed opportunistically. Each entry carries a
 * stable idempotency key, so replaying the queue can never check the same
 * person in twice.
 */

const QUEUE_KEY = "earnival-checkin-queue-v1";

export interface QueuedScan {
  idempotencyKey: string;
  eventId: string;
  scanned?: string;
  code?: string;
  queuedAt: number;
}

export interface CheckInResponse {
  ok: boolean;
  message: string;
  ticket?: {
    id: string;
    attendeeName: string;
    ticketTypeName: string;
    code: string;
    alreadyCheckedIn: boolean;
  };
  queued?: boolean;
}

function readQueue(): QueuedScan[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(QUEUE_KEY) ?? "[]") as QueuedScan[];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedScan[]): void {
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent("earnival:checkin-queue"));
  } catch {
    // Nothing useful to do if storage is unavailable.
  }
}

export function queueLength(): number {
  return readQueue().length;
}

function newKey(): string {
  return `ci_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function post(scan: QueuedScan): Promise<CheckInResponse> {
  const res = await fetch("/api/checkin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventId: scan.eventId,
      scanned: scan.scanned,
      code: scan.code,
      idempotencyKey: scan.idempotencyKey,
    }),
  });
  return (await res.json()) as CheckInResponse;
}

/** Attempts a check-in immediately; queues it if the network is down. */
export async function submitCheckIn(input: {
  eventId: string;
  scanned?: string;
  code?: string;
}): Promise<CheckInResponse> {
  const scan: QueuedScan = {
    idempotencyKey: newKey(),
    eventId: input.eventId,
    scanned: input.scanned,
    code: input.code,
    queuedAt: Date.now(),
  };

  try {
    return await post(scan);
  } catch {
    writeQueue([...readQueue(), scan]);
    return {
      ok: true,
      queued: true,
      message: "Saved offline — will sync when you're back online",
    };
  }
}

/** Drains the queue. Safe to call repeatedly. */
export async function flushQueue(): Promise<number> {
  const queue = readQueue();
  if (queue.length === 0) return 0;

  const remaining: QueuedScan[] = [];
  let flushed = 0;

  for (const scan of queue) {
    try {
      await post(scan);
      flushed += 1;
    } catch {
      remaining.push(scan);
    }
  }

  writeQueue(remaining);
  return flushed;
}

export function watchConnectivity(onFlush: (count: number) => void): () => void {
  const handler = async () => {
    const count = await flushQueue();
    if (count > 0) onFlush(count);
  };
  window.addEventListener("online", handler);
  const timer = window.setInterval(handler, 30_000);
  return () => {
    window.removeEventListener("online", handler);
    window.clearInterval(timer);
  };
}
