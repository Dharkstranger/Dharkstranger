"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  flushQueue,
  queueLength,
  submitCheckIn,
  watchConnectivity,
  type CheckInResponse,
} from "@/lib/checkin-client";
import { btnClass } from "./ui";

type Feedback = CheckInResponse & { at: number };

export function Scanner({ eventId, eventName }: { eventId: string; eventName: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  /** Debounces the camera, which happily decodes the same badge 30×/second. */
  const lastScanRef = useRef<{ value: string; at: number }>({ value: "", at: 0 });

  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setPendingCount(queueLength());
    setOnline(navigator.onLine);

    const sync = () => setPendingCount(queueLength());
    window.addEventListener("earnival:checkin-queue", sync);

    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    const stopWatching = watchConnectivity((count) => {
      setFeedback({ ok: true, message: `Synced ${count} offline check-in(s)`, at: Date.now() });
      setPendingCount(queueLength());
    });

    return () => {
      window.removeEventListener("earnival:checkin-queue", sync);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      stopWatching();
    };
  }, []);

  const handleResult = useCallback(
    async (text: string) => {
      const now = Date.now();
      if (lastScanRef.current.value === text && now - lastScanRef.current.at < 3000) {
        return;
      }
      lastScanRef.current = { value: text, at: now };

      const result = await submitCheckIn({ eventId, scanned: text });
      setFeedback({ ...result, at: now });
      setPendingCount(queueLength());

      if (typeof navigator.vibrate === "function") {
        navigator.vibrate(result.ok ? 60 : [40, 60, 40]);
      }
    },
    [eventId],
  );

  async function start() {
    setError(null);
    try {
      // Loaded on demand so the scanner bundle never ships to buyers.
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader();
      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current!,
        (result) => {
          if (result) void handleResult(result.getText());
        },
      );
      controlsRef.current = controls;
      setScanning(true);
    } catch (err) {
      setError(
        err instanceof Error && err.name === "NotAllowedError"
          ? "Camera permission denied. Use the code entry below instead."
          : "Could not start the camera. Use the code entry below instead.",
      );
    }
  }

  function stop() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
  }

  useEffect(() => () => controlsRef.current?.stop(), []);

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    if (!manualCode.trim()) return;
    const result = await submitCheckIn({ eventId, code: manualCode.trim().toUpperCase() });
    setFeedback({ ...result, at: Date.now() });
    setPendingCount(queueLength());
    if (result.ok) setManualCode("");
  }

  return (
    <div className="px-4 pb-16 pt-4">
      <p className="mb-3 text-[13px] text-mute">
        Point at the badge QR. {eventName}
      </p>

      {(!online || pendingCount > 0) && (
        <div className="mb-3 rounded-2xl bg-[#FFF1D2] px-3.5 py-2.5 text-[12px] text-[#8a5f00]">
          {!online && <b>Offline. </b>}
          {pendingCount > 0
            ? `${pendingCount} check-in(s) saved locally — they sync automatically.`
            : "Scans will be saved locally and synced when you're back online."}
          {pendingCount > 0 && online && (
            <button
              type="button"
              onClick={async () => {
                const count = await flushQueue();
                setPendingCount(queueLength());
                if (count) {
                  setFeedback({ ok: true, message: `Synced ${count}`, at: Date.now() });
                }
              }}
              className="ml-2 font-bold underline"
            >
              Sync now
            </button>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-3xl border-[1.5px] border-line bg-night">
        <video
          ref={videoRef}
          className="aspect-square w-full object-cover"
          muted
          playsInline
        />
      </div>

      <div className="mt-3">
        {scanning ? (
          <button type="button" onClick={stop} className={btnClass("quiet")}>
            Stop camera
          </button>
        ) : (
          <button type="button" onClick={start} className={btnClass("flame")}>
            Start camera
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-[13px] font-medium text-[#B23A0A]">
          {error}
        </p>
      )}

      {feedback && (
        <div
          role="status"
          className={`mt-4 rounded-3xl border-[1.5px] p-4 text-center ${
            feedback.ok
              ? "border-leaf bg-[#E3F0E7]"
              : "border-[#B23A0A] bg-[#FFE7DC]"
          }`}
        >
          <div className="text-3xl">{feedback.ok ? "✅" : "⛔"}</div>
          <div className="mt-1 font-display text-[17px] font-extrabold">
            {feedback.ticket?.attendeeName ?? (feedback.ok ? "Checked in" : "Not valid")}
          </div>
          <div className="text-[13px] text-mute">{feedback.message}</div>
          {feedback.ticket && (
            <div className="mt-1 font-mono text-[12px] text-mute">
              {feedback.ticket.ticketTypeName} · {feedback.ticket.code}
            </div>
          )}
        </div>
      )}

      <form onSubmit={submitManual} className="mt-6">
        <label className="label block">Or type the check-in code</label>
        <div className="flex gap-2">
          <input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value.toUpperCase())}
            placeholder="GG-8K4M"
            className="field font-mono"
          />
          <button type="submit" className={btnClass("primary", { full: false })}>
            Check in
          </button>
        </div>
        <p className="mt-2 text-[11px] text-mute">
          The code is printed on the attendee&apos;s ticket email.
        </p>
      </form>
    </div>
  );
}
