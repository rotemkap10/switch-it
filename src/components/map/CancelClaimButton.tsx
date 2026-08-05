"use client";

import { useActionState, useState } from "react";

import {
  cancelClaim,
  type CancelClaimActionState,
} from "@/actions/claims";
import { useActionFeedback } from "@/components/feedback/useActionFeedback";
import { Button } from "@/components/ui/Button";
import { FEEDBACK_SUCCESS_KEYS } from "@/lib/feedback/success-keys";

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

  useActionFeedback(state, {
    successMessage: FEEDBACK_SUCCESS_KEYS["claim-cancelled"],
    toastErrors: true,
  });

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
      >
        I’m no longer coming
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="claim_id" value={claimId} />
      <p className="text-xs leading-5 text-muted">Stop heading to this spot?</p>
      <div className="flex flex-col items-center gap-2">
        <Button
          type="submit"
          variant="ghost"
          loading={pending}
          disabled={pending}
          className="min-w-[10rem] px-3 py-1.5 text-xs text-muted hover:text-foreground"
        >
          {pending ? "Cancelling…" : "Yes, stop"}
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
