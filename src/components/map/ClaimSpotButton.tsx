"use client";

import { useActionState } from "react";

import { claimSpot, type ClaimSpotActionState } from "@/actions/claims";
import { useActionFeedback } from "@/components/feedback/useActionFeedback";
import { Button } from "@/components/ui/Button";
import { FEEDBACK_SUCCESS_KEYS } from "@/lib/feedback/success-keys";

const initialState: ClaimSpotActionState = {};

type ClaimSpotButtonProps = {
  spotId: string;
};

export function ClaimSpotButton({ spotId }: ClaimSpotButtonProps) {
  const [state, formAction, pending] = useActionState(claimSpot, initialState);

  useActionFeedback(state, {
    successMessage: FEEDBACK_SUCCESS_KEYS["claim-created"],
    toastErrors: true,
  });

  if (state.success) {
    return (
      <p className="text-sm text-muted" role="status">
        Opening your trip…
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="spot_id" value={spotId} />
      <Button
        type="submit"
        loading={pending}
        disabled={pending}
        className="w-full"
      >
        {pending ? "Claiming…" : "I’m on my way"}
      </Button>
    </form>
  );
}
