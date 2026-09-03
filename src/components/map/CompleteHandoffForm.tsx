"use client";

import { useActionState, useEffect } from "react";

import {
  completeClaim,
  type CompleteClaimActionState,
} from "@/actions/claims";
import { useActionFeedback } from "@/components/feedback/useActionFeedback";
import { PlateSuffixInput } from "@/components/map/PlateSuffixInput";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { presentHandoffCompletionSuccess } from "@/lib/handoff/handoff-completion-success";
import { sensoryHandoffCompleted } from "@/lib/sensory/feedback";
import {
  realtimeFeedbackKey,
  useSuppressRealtimeOnSuccess,
} from "@/lib/realtime/use-suppress-realtime-on-success";

const initialState: CompleteClaimActionState = {};

type CompleteHandoffFormProps = {
  claimId: string;
  /** Called after a successful completion (including already-completed). */
  onCompleted?: () => void;
  /** Visual emphasis only — does not change completion rules. */
  emphasized?: boolean;
};

export function CompleteHandoffForm({
  claimId,
  onCompleted,
  emphasized = false,
}: CompleteHandoffFormProps) {
  const [state, formAction, pending] = useActionState(
    completeClaim,
    initialState,
  );

  useActionFeedback(state, {
    successMessage: (s) =>
      s.alreadyCompleted ? "Handoff already completed." : null,
    toastErrors: false,
  });

  useSuppressRealtimeOnSuccess(
    state.success,
    realtimeFeedbackKey("claim", claimId, "completed"),
  );

  useEffect(() => {
    if (state.success) {
      if (!state.alreadyCompleted) {
        sensoryHandoffCompleted(claimId);
        presentHandoffCompletionSuccess({ claimId, role: "publisher" });
      }
      onCompleted?.();
    }
  }, [state.success, state.alreadyCompleted, claimId, onCompleted]);

  if (state.success) {
    return (
      <div className="space-y-2" data-testid="handoff-complete-status" role="status">
        <p className="text-center text-sm text-muted">
          {state.alreadyCompleted
            ? "Handoff already completed."
            : "Updating your spot…"}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3" data-testid="complete-handoff-form">
      <input type="hidden" name="claim_id" value={claimId} />

      <div>
        <h3 className="text-sm font-semibold text-foreground">
          Confirm the arriving vehicle
        </h3>
        <p className="mt-0.5 text-xs leading-5 text-muted">
          Enter the last 2 digits of the arriving vehicle’s plate.
        </p>
      </div>

      <PlateSuffixInput
        id={`plate_suffix_${claimId}`}
        name="plate_suffix"
        disabled={pending || state.lockout}
        error={state.fieldErrors?.plate_suffix?.[0]}
        key={state.lockout ? "lockout" : "default"}
      />

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <Button
        type="submit"
        variant="secondary"
        loading={pending}
        disabled={pending || state.lockout}
        className="w-full !min-h-[var(--app-tap-min)] border-2 border-accent bg-surface text-base font-semibold text-foreground hover:bg-accent-soft"
        data-testid="complete-handoff-submit"
        data-emphasized={emphasized ? "true" : "false"}
      >
        {pending ? "Verifying…" : "Confirm handoff"}
      </Button>
    </form>
  );
}
