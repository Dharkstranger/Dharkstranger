import type { ReactNode } from "react";

/**
 * Wraps console routes so they use the whole screen on a laptop while staying
 * a single column on a phone. Buying stays phone-shaped; running an event does
 * not have to be.
 */
export function ConsoleShell({ children }: { children: ReactNode }) {
  return (
    <div className="console-breakout bg-paper">
      <div className="mx-auto min-h-screen w-full max-w-5xl">{children}</div>
    </div>
  );
}
