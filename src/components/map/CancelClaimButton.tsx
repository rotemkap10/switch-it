"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  cancelClaim,
  type CancelClaimActionState,
} from "@/actions/claims";
import { CancellationReasonSheet } from "@/components/handoff/CancellationReasonSheet";
import { useActionFeedback } from "@/components/feedback/useActionFeedback";
import { Button } from "@/components/ui/Button";
import { FEEDBACK_SUCCESS_KEYS } from "@/lib/feedback/success-keys";
import {
  SEEKER_CANCEL_REASON_LABELS,
  SEEKER_CANCEL_REASONS,
} from "@/lib/handoff/cancellation-reasons";
import {
  realtimeFeedbackKey,
  useSuppressRealtimeOnSuccess,
} from "@/lib/realtime/use-suppress-realtime-on-success";

const initialState: CancelClaimActionState = {};

const SEEKER_OPTIONS = SEEKER_CANCEL_REASONS.map((value) => ({
  value,
  label: SEEKER_CANCEL_REASON_LABELS[value],
}));

type CancelClaimButtonProps = {
  claimId: string;
  /** Called after a successful cancel / already-cancelled terminal result. */
  onCancelled?: () => void;
};

export function CancelClaimButton({
  claimId,
  onCancelled,
}: CancelClaimButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(
    cancelClaim,
    initialState,
  );
  const triggerRef = useRef<HTMLButtonElement | null>(null);

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

  if (state.success) {
    return (
      <p className="text-xs text-muted" role="status">
        Updating your trip…
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-testid="cancel-claim-prompt">
      <Button
        ref={triggerRef}
        type="button"
        variant="dangerOutline"
        className="w-full !min-h-[var(--app-tap-min)]"
        onClick={() => {
          setReason(null);
          setOpen(true);
        }}
        data-testid="cancel-claim-trigger"
      >
        Release spot
      </Button>

      <CancellationReasonSheet
        open={open && !state.success}
        onClose={() => {
          setOpen(false);
          setReason(null);
        }}
        title="Why are you releasing the spot?"
        options={SEEKER_OPTIONS}
        selected={reason}
        onSelectedChange={setReason}
        formAction={formAction}
        hiddenFields={{ claim_id: claimId }}
        confirmLabel="Release spot"
        confirmPendingLabel="Releasing…"
        closeLabel="Keep handoff"
        pending={pending}
        testId="cancel-claim-confirm"
        returnFocusRef={triggerRef}
      />
    </div>
  );
}
