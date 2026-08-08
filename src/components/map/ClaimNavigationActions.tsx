"use client";

import { useOptionalPostClaimNavigation } from "@/components/map/PostClaimNavigationProvider";
import {
  isValidNavigationCoords,
  NAVIGATION_PROVIDER_LABELS,
} from "@/lib/map/navigation-urls";

type ClaimNavigationActionsProps = {
  claimId: string;
  latitude: number;
  longitude: number;
  fullWidth?: boolean;
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
      : "Open navigation";

  return (
    <button
      type="button"
      data-testid="claim-navigation-action"
      className="motion-interactive-press inline-flex min-h-10 w-fit max-w-full items-center rounded-lg border border-border bg-surface px-3 text-sm font-medium text-foreground"
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
    </button>
  );
}
