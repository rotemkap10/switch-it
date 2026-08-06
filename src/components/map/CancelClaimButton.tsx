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
};

export function CancelClaimButton({ claimId }: CancelClaimButtonProps) {
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
      <button
        type="button"
        className="w-full px-0 py-1 text-center text-xs text-muted underline-offset-2 hover:text-foreground hover:underline disabled:opacity-60"
        onClick={() => setConfirming(true)}
        data-testid="cancel-claim-trigger"
      >
        Cancel handoff
      </button>
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
        Cancel this handoff?
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
          className="w-full"
          onClick={() => setConfirming(false)}
        >
          Keep handoff
        </Button>
        <Button
          type="submit"
          variant="ghost"
          loading={pending}
          disabled={pending}
          className="w-full px-0 py-1 text-xs text-muted underline-offset-2 hover:text-foreground hover:underline"
        >
          {pending ? "Cancelling…" : "Cancel handoff"}
        </Button>
      </form>
    </div>
  );
}
