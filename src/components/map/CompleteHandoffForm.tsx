"use client";

import { useActionState } from "react";

import {
  completeClaim,
  type CompleteClaimActionState,
} from "@/actions/claims";
import { useActionFeedback } from "@/components/feedback/useActionFeedback";
import { HandoffCompleteCelebration } from "@/components/illustrations/HandoffCompleteCelebration";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FEEDBACK_SUCCESS_KEYS } from "@/lib/feedback/success-keys";
import {
  realtimeFeedbackKey,
  useSuppressRealtimeOnSuccess,
} from "@/lib/realtime/use-suppress-realtime-on-success";

const initialState: CompleteClaimActionState = {};

type CompleteHandoffFormProps = {
  claimId: string;
};

export function CompleteHandoffForm({ claimId }: CompleteHandoffFormProps) {
  const [state, formAction, pending] = useActionState(
    completeClaim,
    initialState,
  );

  useActionFeedback(state, {
    successMessage: (s) =>
      s.alreadyCompleted
        ? "Handoff already completed."
        : FEEDBACK_SUCCESS_KEYS["handoff-completed"],
    // Incorrect / locked codes stay next to the input — no duplicate toast.
    toastErrors: false,
  });

  useSuppressRealtimeOnSuccess(
    state.success,
    realtimeFeedbackKey("claim", claimId, "completed"),
  );

  if (state.success) {
    return (
      <div className="space-y-2" data-testid="handoff-complete-status" role="status">
        <HandoffCompleteCelebration animate />
        <p className="text-center text-sm text-muted">Updating your trip…</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3" data-testid="complete-handoff-form">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          Complete the handoff
        </h3>
        <p className="mt-1 text-xs leading-5 text-muted">
          Ask the driver for the 5-digit handoff code.
        </p>
      </div>

      <input type="hidden" name="claim_id" value={claimId} />

      <Input
        id={`handoff_code_${claimId}`}
        name="handoff_code"
        label="Handoff code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={5}
        disabled={pending || state.lockout}
        defaultValue=""
        key={state.lockout ? "lockout" : "default"}
        error={state.fieldErrors?.handoff_code?.[0]}
        className="font-mono tracking-[0.2em]"
      />

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <Button
        type="submit"
        variant="secondary"
        loading={pending}
        disabled={pending || state.lockout}
        className="w-full min-w-[12rem] border-success/25 bg-success-bg text-foreground hover:bg-success-bg/80"
      >
        {pending ? "Verifying…" : "Verify and complete"}
      </Button>
    </form>
  );
}
