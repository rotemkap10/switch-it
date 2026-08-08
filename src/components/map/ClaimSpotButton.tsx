"use client";

import { useActionState } from "react";

import { claimSpot, type ClaimSpotActionState } from "@/actions/claims";
import { useActionFeedback } from "@/components/feedback/useActionFeedback";
import { Button } from "@/components/ui/Button";
import { FEEDBACK_SUCCESS_KEYS } from "@/lib/feedback/success-keys";
import { offerPostClaimNavigation } from "@/lib/map/post-claim-navigation";

const initialState: ClaimSpotActionState = {};

async function claimSpotAndOfferNavigation(
  prev: ClaimSpotActionState,
  formData: FormData,
): Promise<ClaimSpotActionState> {
  const result = await claimSpot(prev, formData);
  if (result.success && result.claimId) {
    offerPostClaimNavigation(result.claimId);
  }
  return result;
}

type ClaimSpotButtonProps = {
  spotId: string;
};

export function ClaimSpotButton({ spotId }: ClaimSpotButtonProps) {
  const [state, formAction, pending] = useActionState(
    claimSpotAndOfferNavigation,
    initialState,
  );

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
