"use client";

import { useActionState, useState } from "react";

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
  const [confirming, setConfirming] = useState(false);
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
            ? "You already got this spot"
            : "You got the spot"
        }
      >
        {typeof state.seekerCredits === "number"
          ? `Your credit balance is now ${state.seekerCredits}.`
          : "Credits were updated."}
      </Alert>
    );
  }

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="secondary"
        className="w-full min-w-[12rem] border-success/25 bg-success-bg text-foreground hover:bg-success-bg/80"
        onClick={() => setConfirming(true)}
      >
        I got the spot
      </Button>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="claim_id" value={claimId} />
      <p className="text-xs leading-5 text-muted">
        Confirm that you received the parking spot
      </p>
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <div className="flex flex-col gap-2">
        <Button
          type="submit"
          variant="secondary"
          loading={pending}
          disabled={pending}
          className="w-full min-w-[12rem] border-success/25 bg-success-bg text-foreground hover:bg-success-bg/80"
        >
          Confirm receipt
        </Button>
        <button
          type="button"
          className="text-center text-xs text-muted underline-offset-2 hover:text-foreground hover:underline"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          Back
        </button>
      </div>
    </form>
  );
}
