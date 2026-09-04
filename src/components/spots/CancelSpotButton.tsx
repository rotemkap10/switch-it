"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  cancelSpot,
  type CancelSpotActionState,
} from "@/actions/spots";
import { CancellationReasonSheet } from "@/components/handoff/CancellationReasonSheet";
import { useActionFeedback } from "@/components/feedback/useActionFeedback";
import { Button } from "@/components/ui/Button";
import { presentHandoffTerminalEnded } from "@/lib/handoff/handoff-terminal-ended";
import {
  PUBLISHER_CANCEL_REASON_LABELS,
  PUBLISHER_CANCEL_REASONS,
} from "@/lib/handoff/cancellation-reasons";
import {
  realtimeFeedbackKey,
  useSuppressRealtimeOnSuccess,
} from "@/lib/realtime/use-suppress-realtime-on-success";

const initialState: CancelSpotActionState = {};

const PUBLISHER_OPTIONS = PUBLISHER_CANCEL_REASONS.map((value) => ({
  value,
  label: PUBLISHER_CANCEL_REASON_LABELS[value],
}));

type CancelSpotButtonProps = {
  spotId: string;
  /** Active claim id when cancelling a claimed handoff — suppresses claim toast echo. */
  claimId?: string | null;
  /** When true, use claimed-handoff copy. */
  claimed?: boolean;
  /** When true, the live handoff timer has already started. */
  handoffStarted?: boolean;
};

export function publisherCancelTriggerLabel(options: {
  claimed: boolean;
  handoffStarted: boolean;
}): string {
  if (!options.claimed) {
    return "Cancel spot";
  }
  if (!options.handoffStarted) {
    return "Cancel handoff";
  }
  return "Leave without handoff";
}

export function CancelSpotButton({
  spotId,
  claimId = null,
  claimed = false,
  handoffStarted = false,
}: CancelSpotButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(
    cancelSpot,
    initialState,
  );
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const triggerLabel = publisherCancelTriggerLabel({
    claimed,
    handoffStarted,
  });

  useActionFeedback(state, {
    toastErrors: true,
  });

  useSuppressRealtimeOnSuccess(
    state.success,
    realtimeFeedbackKey("spot", spotId, "cancelled"),
  );
  useSuppressRealtimeOnSuccess(
    Boolean(state.success && claimId),
    claimId ? realtimeFeedbackKey("claim", claimId, "cancelled") : null,
  );

  useEffect(() => {
    if (!state.success) {
      return;
    }
    presentHandoffTerminalEnded({
      id: claimId ?? spotId,
      role: "publisher",
      kind: "publisher_cancelled",
    });
  }, [state.success, claimId, spotId]);

  if (state.success) {
    return (
      <p className="text-xs text-muted" role="status">
        {claimed
          ? "Handoff cancelled. You can leave now."
          : "Updating your spot…"}
      </p>
    );
  }

  const title = claimed
    ? "Why are you ending the handoff?"
    : "Why are you cancelling this spot?";
  const closeLabel = claimed ? "Keep waiting" : "Keep spot active";
  const confirmLabel = claimed ? "End handoff" : "Cancel spot";
  const confirmPendingLabel =
    claimed && handoffStarted ? "Leaving…" : "Cancelling…";

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="dangerOutline"
        className="w-full !min-h-[var(--app-tap-min)]"
        onClick={() => {
          setReason(null);
          setOpen(true);
        }}
        data-testid="cancel-spot-trigger"
      >
        {triggerLabel}
      </Button>

      <CancellationReasonSheet
        open={open && !state.success}
        onClose={() => {
          setOpen(false);
          setReason(null);
        }}
        title={title}
        options={PUBLISHER_OPTIONS}
        selected={reason}
        onSelectedChange={setReason}
        formAction={formAction}
        hiddenFields={{ spot_id: spotId }}
        confirmLabel={confirmLabel}
        confirmPendingLabel={confirmPendingLabel}
        closeLabel={closeLabel}
        pending={pending}
        testId="cancel-spot-confirm"
        returnFocusRef={triggerRef}
      />
    </>
  );
}
