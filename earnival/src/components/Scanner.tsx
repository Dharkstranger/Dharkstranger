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

/**
 * The door scanner.
 *
 * Design constraints come from the gate, not the browser: someone is holding a
 * phone in one hand at night with a queue in front of them. So feedback is
 * full-bleed colour readable at arm's length, backed by sound and haptics
 * because a screen glance is not always possible, and the running count is
 * always visible so they know where they are without leaving the screen.
 */

type Feedback = CheckInResponse & { at: number };

interface RecentScan {
  id: string;
  name: string;
  detail: string;
  ok: boolean;
  at: number;
}

/** Short tones — distinct enough to tell apart without looking. */
function playTone(kind: "ok" | "fail") {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;

    const context = new Ctor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.type = kind === "ok" ? "sine" : "square";
    oscillator.frequency.value = kind === "ok" ? 880 : 220;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.28);

    oscillator.start();
    oscillator.stop(context.currentTime + 0.3);
    oscillator.onended = () => void context.close();
  } catch {
    // Audio is a nicety; never let it break a check-in.
  }
}

export function Scanner({
  eventId,
  eventName,
  checkedInCount,
  totalCount,
}: {
  eventId: string;
  eventName: string;
  checkedInCount: number;
  totalCount: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  /** Debounces the camera, which decodes the same badge many times a second. */
  const lastScanRef = useRef<{ value: string; at: number }>({ value: "", at: 0 });

  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [recent, setRecent] = useState<RecentScan[]>([]);
  const [sessionCount, setSessionCount] = useState(0);
  const [manualCode, setManualCode] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [online, setOnline] = useState(true);
  const [soundOn, setSoundOn] = useState(true);

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
      setFeedback({
        ok: true,
        message: `Synced ${count} offline check-in${count > 1 ? "s" : ""}`,
        at: Date.now(),
      });
      setPendingCount(queueLength());
    });

    return () => {
      window.removeEventListener("earnival:checkin-queue", sync);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      stopWatching();
    };
  }, []);

  const record = useCallback(
    (result: CheckInResponse) => {
      setFeedback({ ...result, at: Date.now() });
      setPendingCount(queueLength());

      if (result.ok) setSessionCount((c) => c + 1);

      if (result.ticket) {
        setRecent((prev) =>
          [
            {
              id: `${result.ticket!.id}-${Date.now()}`,
              name: result.ticket!.attendeeName,
              detail: `${result.ticket!.ticketTypeName} · ${result.ticket!.code}`,
              ok: result.ok,
              at: Date.now(),
            },
            ...prev,
          ].slice(0, 8),
        );
      }

      if (soundOn) playTone(result.ok ? "ok" : "fail");
      if (typeof navigator.vibrate === "function") {
        navigator.vibrate(result.ok ? 60 : [50, 60, 50]);
      }
    },
    [soundOn],
  );

  const handleResult = useCallback(
    async (text: string) => {
      const now = Date.now();
      if (lastScanRef.current.value === text && now - lastScanRef.current.at < 2500) {
        return;
      }
      lastScanRef.current = { value: text, at: now };
      record(await submitCheckIn({ eventId, scanned: text }));
    },
    [eventId, record],
  );

  async function start() {
    setError(null);
    try {
      // Loaded on demand so the decoder never ships to ticket buyers.
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
          ? "Camera permission was denied. Use the code entry below instead."
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
    const result = await submitCheckIn({
      eventId,
      code: manualCode.trim().toUpperCase(),
    });
    record(result);
    if (result.ok) setManualCode("");
  }

  const totalIn = checkedInCount + sessionCount;

  return (
    <div className="px-4 pb-16 pt-4">
      {/* Running count — always visible, no navigation needed. */}
      <div className="mb-3 flex items-center justify-between rounded-2xl bg-night px-4 py-3 text-white">
        <div>
          <div className="text-[12px] text-[#C9BFD6]">Checked in</div>
          <div className="font-display text-[22px] font-extrabold tabular-nums">
            {totalIn}
            <span className="text-[15px] font-semibold text-[#C9BFD6]">
              {" "}
              / {totalCount}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[12px] text-[#C9BFD6]">This session</div>
          <div className="font-display text-[22px] font-extrabold tabular-nums text-marigold">
            {sessionCount}
          </div>
        </div>
      </div>

      <p className="mb-3 text-[13px] text-mute">{eventName}</p>

      {(!online || pendingCount > 0) && (
        <div className="mb-3 rounded-2xl bg-[#FFF1D2] px-3.5 py-2.5 text-[13px] text-[#8a5f00]">
          {!online && <b>Offline. </b>}
          {pendingCount > 0
            ? `${pendingCount} check-in${pendingCount > 1 ? "s" : ""} saved on this device — they sync automatically.`
            : "Scans are saved on this device and sync when you're back online."}
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

      {/* Feedback sits above the viewfinder: it is what matters at the gate. */}
      <div
        role="status"
        aria-live="assertive"
        className={`mb-3 rounded-3xl border-[3px] p-5 text-center transition-colors ${
          !feedback
            ? "border-line bg-white"
            : feedback.ok
              ? "border-leaf bg-[#E3F0E7]"
              : "border-[#B23A0A] bg-[#FFE7DC]"
        }`}
      >
        {!feedback ? (
          <p className="py-2 text-[14px] text-mute">Ready to scan</p>
        ) : (
          <>
            <div className="text-5xl" aria-hidden>
              {feedback.ok ? "✅" : "⛔"}
            </div>
            <p className="mt-1 font-display text-[22px] font-extrabold leading-tight">
              {feedback.ticket?.attendeeName ?? (feedback.ok ? "Checked in" : "Not valid")}
            </p>
            <p className="text-[14px] text-mute">{feedback.message}</p>
            {feedback.ticket && (
              <p className="mt-1 font-mono text-[13px] text-mute">
                {feedback.ticket.ticketTypeName} · {feedback.ticket.code}
              </p>
            )}
          </>
        )}
      </div>

      <div className="overflow-hidden rounded-3xl border-[1.5px] border-line bg-night">
        <video
          ref={videoRef}
          className="aspect-square w-full object-cover"
          muted
          playsInline
          aria-label="Camera viewfinder"
        />
      </div>

      <div className="mt-3 flex gap-2">
        {scanning ? (
          <button type="button" onClick={stop} className={btnClass("quiet")}>
            Stop camera
          </button>
        ) : (
          <button type="button" onClick={start} className={btnClass("flame")}>
            Start camera
          </button>
        )}
        <button
          type="button"
          onClick={() => setSoundOn((s) => !s)}
          aria-pressed={soundOn}
          className={`shrink-0 rounded-2xl px-4 py-3.5 text-[15px] font-semibold ${
            soundOn ? "bg-night text-white" : "bg-haze text-night"
          }`}
        >
          {soundOn ? "🔊 Sound on" : "🔇 Sound off"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-[13px] font-medium text-[#B23A0A]">
          {error}
        </p>
      )}

      <form onSubmit={submitManual} className="mt-6">
        <label htmlFor="manual-code" className="label block">
          Or type the check-in code
        </label>
        <div className="flex gap-2">
          <input
            id="manual-code"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value.toUpperCase())}
            placeholder="GG-8K4M"
            autoComplete="off"
            autoCapitalize="characters"
            className="field font-mono"
          />
          <button type="submit" className={btnClass("primary", { full: false })}>
            Check in
          </button>
        </div>
        <p className="mt-2 text-[12px] text-mute">
          It&apos;s printed on the attendee&apos;s ticket email.
        </p>
      </form>

      {recent.length > 0 && (
        <>
          <h2 className="mb-2 mt-8 font-display text-[15px] font-bold">Just scanned</h2>
          <ul className="space-y-1.5">
            {recent.map((scan) => (
              <li
                key={scan.id}
                className="flex items-center justify-between rounded-xl border-[1.5px] border-line bg-white px-3.5 py-2.5"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold">
                    {scan.name}
                  </span>
                  <span className="block font-mono text-[12px] text-mute">
                    {scan.detail}
                  </span>
                </span>
                <span className="shrink-0 pl-2 text-[13px]" aria-hidden>
                  {scan.ok ? "✅" : "⛔"}
                </span>
                <span className="sr-only">
                  {scan.ok ? "Checked in" : "Rejected"}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
