"use client";

import { Button } from "@/components/ui/Button";

type HandoffPushPrepromptProps = {
  onEnable: () => void;
  onNotNow: () => void;
};

export function HandoffPushPreprompt({
  onEnable,
  onNotNow,
}: HandoffPushPrepromptProps) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-foreground/30 p-4 sm:items-center"
      data-testid="handoff-push-preprompt"
      role="dialog"
      aria-modal="true"
      aria-labelledby="handoff-push-preprompt-title"
    >
      <div className="w-full max-w-md rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2
          id="handoff-push-preprompt-title"
          className="text-lg font-semibold text-foreground"
        >
          Stay updated during your handoff
        </h2>
        <p className="mt-2 text-sm text-muted">
          Allow notifications so we can alert you if the other driver cancels,
          gets close, or the handoff changes while you&apos;re using Waze.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onNotNow}>
            Not now
          </Button>
          <Button type="button" onClick={onEnable}>
            Enable notifications
          </Button>
        </div>
      </div>
    </div>
  );
}
