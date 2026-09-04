"use client";

import { HandoffEndedIcon } from "@/components/illustrations/HandoffEndedIcon";
import { Button } from "@/components/ui/Button";
import {
  handoffTerminalEndedCopy,
  type HandoffTerminalEndedKind,
} from "@/lib/handoff/handoff-terminal-ended";
import type { HandoffCompletionRole } from "@/lib/handoff/handoff-completion-success";

type HandoffTerminalEndedOverlayProps = {
  role: HandoffCompletionRole;
  kind: HandoffTerminalEndedKind;
  exiting?: boolean;
  onContinue: () => void;
};

export function HandoffTerminalEndedOverlay({
  role,
  kind,
  exiting = false,
  onContinue,
}: HandoffTerminalEndedOverlayProps) {
  const copy = handoffTerminalEndedCopy(kind, role);

  return (
    <div
      className={[
        "handoff-terminal-backdrop",
        exiting ? "is-exiting" : "motion-fade-in",
      ].join(" ")}
      data-testid="handoff-terminal-overlay"
      data-role={role}
      data-kind={kind}
      data-exiting={exiting ? "true" : "false"}
    >
      <div
        className="handoff-terminal-card motion-soft-scale-in"
        role="status"
        aria-live="polite"
        aria-labelledby="handoff-terminal-title"
      >
        <HandoffEndedIcon className="h-10 w-10" />
        <h2
          id="handoff-terminal-title"
          className="text-lg font-semibold tracking-tight text-foreground"
        >
          {copy.title}
        </h2>
        <p className="text-sm leading-5 text-muted">{copy.detail}</p>
        <p
          className="text-sm font-medium leading-5 text-[var(--color-handoff-terminal-accent)]"
          data-testid="handoff-terminal-credit"
        >
          {copy.credit}
        </p>
        <Button
          type="button"
          variant="secondary"
          className="mt-1 w-full"
          onClick={onContinue}
          disabled={exiting}
          data-testid="handoff-terminal-continue"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
