"use client";

import { useActionState } from "react";

import {
  completeClaim,
  type CompleteClaimActionState,
} from "@/actions/claims";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

const initialState: CompleteClaimActionState = {};

type CompleteClaimButtonProps = {
  claimId: string;
};

export function CompleteClaimButton({ claimId }: CompleteClaimButtonProps) {
  const [state, formAction, pending] = useActionState(
    completeClaim,
    initialState,
  );

  if (state.success) {
    return (
      <Alert
        tone="success"
        title={
          state.alreadyCompleted
            ? "Handoff was already completed"
            : "Handoff completed"
        }
      >
        {typeof state.seekerCredits === "number"
          ? `Your credit balance is now ${state.seekerCredits}.`
          : "Credits were updated."}
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="claim_id" value={claimId} />
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Completing…" : "Complete handoff"}
      </Button>
    </form>
  );
}
