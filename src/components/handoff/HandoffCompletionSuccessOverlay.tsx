"use client";

import { CheckMarkIcon } from "@/components/illustrations/CheckMarkIcon";
import { CoinIcon } from "@/components/illustrations/CoinIcon";
import { Button } from "@/components/ui/Button";
import {
  HANDOFF_COMPLETION_COPY,
  type HandoffCompletionRole,
} from "@/lib/handoff/handoff-completion-success";

type HandoffCompletionSuccessOverlayProps = {
  role: HandoffCompletionRole;
  exiting?: boolean;
  onContinue: () => void;
};

export function HandoffCompletionSuccessOverlay({
  role,
  exiting = false,
  onContinue,
}: HandoffCompletionSuccessOverlayProps) {
  const copy = HANDOFF_COMPLETION_COPY[role];

  return (
    <div
      className={[
        "handoff-success-backdrop",
        exiting ? "is-exiting" : "motion-fade-in",
      ].join(" ")}
      data-testid="handoff-success-overlay"
      data-role={role}
      data-exiting={exiting ? "true" : "false"}
    >
      <div
        className="handoff-success-card motion-soft-scale-in"
        role="status"
        aria-live="polite"
        aria-labelledby="handoff-success-title"
      >
        <CheckMarkIcon className="h-12 w-12" animated />
        <h2
          id="handoff-success-title"
          className="text-xl font-semibold tracking-tight text-foreground"
        >
          {copy.title}
        </h2>
        <p
          className="inline-flex items-center gap-1.5 text-lg font-semibold tabular-nums text-success"
          data-testid="handoff-success-credit"
        >
          <CoinIcon className="h-6 w-6" />
          {copy.credit}
        </p>
        <p className="text-sm leading-5 text-muted">{copy.detail}</p>
        <Button
          type="button"
          variant="primary"
          className="mt-1 w-full"
          onClick={onContinue}
          disabled={exiting}
          data-testid="handoff-success-continue"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
