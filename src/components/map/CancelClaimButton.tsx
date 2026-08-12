"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";

import {
  cancelClaim,
  type CancelClaimActionState,
} from "@/actions/claims";
import { useActionFeedback } from "@/components/feedback/useActionFeedback";
import { Button } from "@/components/ui/Button";
import { FEEDBACK_SUCCESS_KEYS } from "@/lib/feedback/success-keys";
import {
  realtimeFeedbackKey,
  useSuppressRealtimeOnSuccess,
} from "@/lib/realtime/use-suppress-realtime-on-success";

const initialState: CancelClaimActionState = {};

type CancelClaimButtonProps = {
  claimId: string;
  /** Called after a successful cancel / already-cancelled terminal result. */
  onCancelled?: () => void;
};

export function CancelClaimButton({
  claimId,
  onCancelled,
}: CancelClaimButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(
    cancelClaim,
    initialState,
  );
  const keepFocusRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const descId = useId();

  useActionFeedback(state, {
    successMessage: FEEDBACK_SUCCESS_KEYS["claim-cancelled"],
    toastErrors: true,
  });

  useSuppressRealtimeOnSuccess(
    state.success,
    realtimeFeedbackKey("claim", claimId, "cancelled"),
  );
  useSuppressRealtimeOnSuccess(
    state.success,
    realtimeFeedbackKey("claim", claimId, "expired"),
  );

  useEffect(() => {
    if (state.success) {
      onCancelled?.();
    }
  }, [state.success, onCancelled]);

  useEffect(() => {
    if (!confirming) {
      return;
    }
    keepFocusRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setConfirming(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [confirming]);

  if (state.success) {
    return (
      <p className="text-xs text-muted" role="status">
        Updating your trip…
      </p>
    );
  }

  if (!confirming) {
    return (
      <div className="flex flex-col gap-2" data-testid="cancel-claim-prompt">
        <p className="text-center text-xs font-medium text-muted">
          Can’t make it?
        </p>
        <Button
          type="button"
          variant="secondary"
          className="w-full !min-h-[var(--app-tap-min)] border border-danger/40 bg-surface text-sm font-semibold text-danger hover:bg-danger/5"
          onClick={() => setConfirming(true)}
          data-testid="cancel-claim-trigger"
        >
          Release spot
        </Button>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="rounded-[var(--radius-card)] border border-border bg-accent-soft/60 p-3"
      data-testid="cancel-claim-confirm"
    >
      <p id={titleId} className="text-sm font-semibold text-foreground">
        Release this spot?
      </p>
      <p id={descId} className="mt-1 text-xs leading-5 text-muted">
        The parking owner will be notified. No credit will be charged.
      </p>
      <form action={formAction} className="mt-3 flex flex-col gap-2">
        <input type="hidden" name="claim_id" value={claimId} />
        <Button
          ref={keepFocusRef}
          type="button"
          variant="secondary"
          disabled={pending}
          className="w-full !min-h-[var(--app-tap-min)]"
          onClick={() => setConfirming(false)}
        >
          Keep handoff
        </Button>
        <Button
          type="submit"
          variant="secondary"
          loading={pending}
          disabled={pending}
          className="w-full !min-h-[var(--app-tap-min)] border border-danger/40 text-danger hover:bg-danger/5"
        >
          {pending ? "Releasing…" : "Release spot"}
        </Button>
      </form>
    </div>
  );
}
