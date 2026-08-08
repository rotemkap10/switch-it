"use client";

import { useActionState, useEffect } from "react";

import { claimSpot, type ClaimSpotActionState } from "@/actions/claims";
import { useActionFeedback } from "@/components/feedback/useActionFeedback";
import { Button } from "@/components/ui/Button";
import { FEEDBACK_SUCCESS_KEYS } from "@/lib/feedback/success-keys";
import { isValidNavigationCoords } from "@/lib/map/navigation-urls";
import {
  logPostClaimNavigationDev,
  offerPostClaimNavigation,
  registerClaimSpotDestination,
  takeClaimSpotDestination,
} from "@/lib/map/post-claim-navigation";

const initialState: ClaimSpotActionState = {};

async function claimSpotAndOfferNavigation(
  prev: ClaimSpotActionState,
  formData: FormData,
): Promise<ClaimSpotActionState> {
  logPostClaimNavigationDev("claim action started");
  const result = await claimSpot(prev, formData);
  if (result.success && result.claimId) {
    logPostClaimNavigationDev("claim success received");
    const spotId = String(formData.get("spot_id") ?? "");
    const destination = takeClaimSpotDestination(spotId);
    if (
      destination &&
      isValidNavigationCoords(destination.latitude, destination.longitude)
    ) {
      offerPostClaimNavigation({
        claimId: result.claimId,
        latitude: destination.latitude,
        longitude: destination.longitude,
      });
    } else {
      logPostClaimNavigationDev("claim success without valid destination");
    }
  }
  return result;
}

type ClaimSpotButtonProps = {
  spotId: string;
  latitude: number;
  longitude: number;
};

export function ClaimSpotButton({
  spotId,
  latitude,
  longitude,
}: ClaimSpotButtonProps) {
  const [state, formAction, pending] = useActionState(
    claimSpotAndOfferNavigation,
    initialState,
  );

  useEffect(() => {
    registerClaimSpotDestination(spotId, latitude, longitude);
  }, [spotId, latitude, longitude]);

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
    <form
      action={formAction}
      className="space-y-2"
      onSubmit={() => {
        logPostClaimNavigationDev("claim click");
        registerClaimSpotDestination(spotId, latitude, longitude);
      }}
    >
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
