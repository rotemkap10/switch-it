"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";

import {
  cancelSpot,
  type CancelSpotActionState,
} from "@/actions/spots";
import { useActionFeedback } from "@/components/feedback/useActionFeedback";
import { Button } from "@/components/ui/Button";
import { FEEDBACK_SUCCESS_KEYS } from "@/lib/feedback/success-keys";
import {
  realtimeFeedbackKey,
  useSuppressRealtimeOnSuccess,
} from "@/lib/realtime/use-suppress-realtime-on-success";

const initialState: CancelSpotActionState = {};

type CancelSpotButtonProps = {
  spotId: string;
  /** When true, use claimed-handoff copy. */
  claimed?: boolean;
};

export function CancelSpotButton({
  spotId,
  claimed = false,
}: CancelSpotButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(
    cancelSpot,
    initialState,
  );
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const keepFocusRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const descId = useId();

  useActionFeedback(state, {
    successMessage: claimed
      ? FEEDBACK_SUCCESS_KEYS["handoff-cancelled-publisher"]
      : FEEDBACK_SUCCESS_KEYS["spot-cancelled"],
    toastErrors: true,
  });

  useSuppressRealtimeOnSuccess(
    state.success,
    realtimeFeedbackKey("spot", spotId, "cancelled"),
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
        {claimed
          ? "Handoff cancelled. You can leave now. No credits were transferred."
          : "Updating your spot…"}
      </p>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        className="w-full px-0 py-1 text-center text-xs text-muted underline-offset-2 hover:text-foreground hover:underline disabled:opacity-60"
        onClick={() => setConfirming(true)}
        data-testid="cancel-spot-trigger"
      >
        {claimed ? "I’m leaving" : "Cancel spot"}
      </button>
    );
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="rounded-[var(--radius-card)] border border-border bg-accent-soft/60 p-3"
      data-testid="cancel-spot-confirm"
    >
      <p id={titleId} className="text-sm font-semibold text-foreground">
        {claimed ? "Leave this handoff?" : "Cancel this parking spot?"}
      </p>
      <p id={descId} className="mt-1 text-xs leading-5 text-muted">
        {claimed
          ? "The driver will be notified and this parking spot will no longer be available. No credits will be transferred."
          : "It will no longer be visible to nearby drivers."}
      </p>
      <form action={formAction} className="mt-3 flex flex-col gap-2">
        <input type="hidden" name="spot_id" value={spotId} />
        <Button
          ref={keepFocusRef}
          type="button"
          variant="secondary"
          disabled={pending}
          className="w-full"
          onClick={() => setConfirming(false)}
        >
          {claimed ? "Keep waiting" : "Keep spot active"}
        </Button>
        <Button
          type="submit"
          variant="ghost"
          loading={pending}
          disabled={pending}
          className="w-full px-0 py-1 text-xs text-muted underline-offset-2 hover:text-foreground hover:underline"
        >
          {pending
            ? "Leaving…"
            : claimed
              ? "I’m leaving"
              : "Cancel spot"}
        </Button>
      </form>
    </div>
  );
}
