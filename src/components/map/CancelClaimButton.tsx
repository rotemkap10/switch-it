"use client";

import { useActionState, useState } from "react";

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
  const [confirming, setConfirming] = useState(false);
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

  if (!confirming) {
    return (
      <button
        type="button"
        className="w-full px-0 py-1 text-center text-xs text-muted underline-offset-2 hover:text-foreground hover:underline disabled:opacity-60"
        onClick={() => setConfirming(true)}
      >
        I’m no longer coming
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="claim_id" value={claimId} />
      <p className="text-xs leading-5 text-muted">Stop heading to this spot?</p>
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <div className="flex flex-col items-center gap-2">
        <Button
          type="submit"
          variant="ghost"
          loading={pending}
          disabled={pending}
          className="min-w-[10rem] px-3 py-1.5 text-xs text-muted hover:text-foreground"
        >
          Yes, stop
        </Button>
        <button
          type="button"
          className="text-xs font-medium text-accent-hover underline-offset-2 hover:underline"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          Keep going
        </button>
      </div>
    </form>
  );
}
