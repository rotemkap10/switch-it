"use client";

import {
  useActionState,
  useEffect,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";

import { claimSpot, type ClaimSpotActionState } from "@/actions/claims";
import { useActionFeedback } from "@/components/feedback/useActionFeedback";
import { Button } from "@/components/ui/Button";
import {
  APP_ERROR_MESSAGES,
  CLAIM_TOO_FAR_HINT,
} from "@/lib/feedback/error-map";
import { FEEDBACK_SUCCESS_KEYS } from "@/lib/feedback/success-keys";
import { requestDiscoverySpotTombstone } from "@/lib/map/discovery-spot-tombstone-bus";
import {
  isValidLatLng,
  isWithinClaimDistance,
  type LatLng,
} from "@/lib/map/distance";
import { isValidNavigationCoords } from "@/lib/map/navigation-urls";
import {
  logPostClaimNavigationDev,
  offerPostClaimNavigation,
  registerClaimSpotDestination,
  takeClaimSpotDestination,
} from "@/lib/map/post-claim-navigation";
import { requestCurrentDeviceLocation } from "@/lib/map/request-current-device-location";
import { discoveryTombstoneReasonForClaimError } from "@/lib/map/seeker-discovery-spots";
import { shouldRevalidateMapAfterClaimFailure } from "@/lib/map/stale-discovery-errors";
import { offerHandoffPushPrepromptBeforeHandoff } from "@/lib/push/preprompt-bus";
import { sensoryLightTap } from "@/lib/sensory/feedback";

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
  /** Latest known seeker fix for client eligibility UX (not the sole authority). */
  seekerLocation?: LatLng | null;
};

export function ClaimSpotButton({
  spotId,
  latitude,
  longitude,
  seekerLocation = null,
}: ClaimSpotButtonProps) {
  const { refresh } = useRouter();
  const [state, formAction, pending] = useActionState(
    claimSpotAndOfferNavigation,
    initialState,
  );
  const [, startClaimTransition] = useTransition();
  const [locating, setLocating] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    registerClaimSpotDestination(spotId, latitude, longitude);
  }, [spotId, latitude, longitude]);

  useEffect(() => {
    if (!shouldRevalidateMapAfterClaimFailure(state.errorCode)) {
      return;
    }
    requestDiscoverySpotTombstone(
      spotId,
      discoveryTombstoneReasonForClaimError(state.errorCode),
    );
    refresh();
  }, [refresh, spotId, state.errorCode]);

  useActionFeedback(state, {
    successMessage: FEEDBACK_SUCCESS_KEYS["claim-created"],
    toastErrors: true,
  });

  const spotCoords = { latitude, longitude };

  if (state.success) {
    return (
      <p className="text-sm text-muted" role="status">
        Opening your trip…
      </p>
    );
  }

  const busy = pending || locating;
  const errorMessage = localError ?? state.error ?? null;
  const showTooFarHint =
    errorMessage === APP_ERROR_MESSAGES.CLAIM_TOO_FAR ||
    state.errorCode === "CLAIM_TOO_FAR";

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        sensoryLightTap();
        logPostClaimNavigationDev("claim click");
        registerClaimSpotDestination(spotId, latitude, longitude);
        setLocalError(null);

        // UX-only early check when a known seeker fix is already available.
        // PostgreSQL claim_spot remains the authoritative distance gate.
        if (
          isValidLatLng(seekerLocation) &&
          !isWithinClaimDistance(seekerLocation, spotCoords)
        ) {
          setLocalError(APP_ERROR_MESSAGES.CLAIM_TOO_FAR);
          return;
        }

        setLocating(true);

        void (async () => {
          try {
            await offerHandoffPushPrepromptBeforeHandoff();
            const result = await requestCurrentDeviceLocation({
              maximumAgeMs: 0,
              timeoutMs: 10_000,
              enableHighAccuracy: true,
            });

            if (!result.ok || !isValidLatLng(result.fix)) {
              setLocalError(APP_ERROR_MESSAGES.LOCATION_REQUIRED);
              return;
            }

            if (!isWithinClaimDistance(result.fix, spotCoords)) {
              setLocalError(APP_ERROR_MESSAGES.CLAIM_TOO_FAR);
              return;
            }

            const formData = new FormData();
            formData.set("spot_id", spotId);
            formData.set("seeker_latitude", String(result.fix.latitude));
            formData.set("seeker_longitude", String(result.fix.longitude));
            startClaimTransition(() => {
              formAction(formData);
            });
          } finally {
            setLocating(false);
          }
        })();
      }}
    >
      {errorMessage ? (
        <div className="space-y-1" role="alert" data-testid="claim-local-error">
          <p className="text-sm text-danger">{errorMessage}</p>
          {showTooFarHint ? (
            <p className="text-xs text-muted">{CLAIM_TOO_FAR_HINT}</p>
          ) : null}
        </div>
      ) : null}
      <Button type="submit" loading={busy} disabled={busy} className="w-full">
        {locating
          ? "Getting location…"
          : pending
            ? "Claiming…"
            : "I’m on my way"}
      </Button>
    </form>
  );
}
