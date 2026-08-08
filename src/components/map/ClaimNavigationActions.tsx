"use client";

import { useOptionalPostClaimNavigation } from "@/components/map/PostClaimNavigationProvider";
import { Button } from "@/components/ui/Button";
import {
  isValidNavigationCoords,
  NAVIGATION_PROVIDER_LABELS,
} from "@/lib/map/navigation-urls";

export const CLAIM_NAVIGATE_ACTION_LABEL = "Navigate to spot";

type ClaimNavigationActionsProps = {
  claimId: string;
  latitude: number;
  longitude: number;
};

export function ClaimNavigationActions({
  claimId,
  latitude,
  longitude,
}: ClaimNavigationActionsProps) {
  const navigation = useOptionalPostClaimNavigation();
  const sessionMatchesClaim = navigation?.session?.claimId === claimId;
  const coords = isValidNavigationCoords(latitude, longitude)
    ? { latitude, longitude }
    : sessionMatchesClaim && navigation?.session
      ? {
          latitude: navigation.session.latitude,
          longitude: navigation.session.longitude,
        }
      : null;

  if (!coords || !navigation) {
    return null;
  }

  const providerSelected =
    sessionMatchesClaim && Boolean(navigation.session?.providerSelected);
  const selectedProviderId = sessionMatchesClaim
    ? navigation.session?.selectedProviderId
    : null;
  const label =
    providerSelected && selectedProviderId
      ? `${NAVIGATION_PROVIDER_LABELS[selectedProviderId]} · Change`
      : CLAIM_NAVIGATE_ACTION_LABEL;

  return (
    <Button
      type="button"
      data-testid="claim-navigation-action"
      className="w-full !min-h-[var(--app-tap-min)] text-base font-semibold"
      aria-haspopup="dialog"
      aria-expanded={Boolean(navigation.session?.open && sessionMatchesClaim)}
      onClick={() => {
        navigation.openManual({
          claimId,
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
      }}
    >
      {label}
    </Button>
  );
}
