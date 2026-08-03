"use client";

import { useActionState } from "react";

import {
  cancelClaim,
  type CancelClaimActionState,
} from "@/actions/claims";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

const initialState: CancelClaimActionState = {};

type CancelClaimButtonProps = {
  claimId: string;
};

export function CancelClaimButton({ claimId }: CancelClaimButtonProps) {
  const [state, formAction, pending] = useActionState(
    cancelClaim,
    initialState,
  );

  if (state.success) {
    return (
      <Alert
        tone="success"
        title={
          state.alreadyCancelled
            ? "You already stepped away"
            : "You’re no longer coming"
        }
      >
        The spot can go to someone else if it is still available.
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="claim_id" value={claimId} />
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <Button
        type="submit"
        variant="ghost"
        disabled={pending}
        className="px-0 text-muted hover:text-foreground"
      >
        {pending ? "Updating…" : "I’m no longer coming"}
      </Button>
    </form>
  );
}
