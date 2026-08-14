"use client";

import { useOptionalPostClaimNavigation } from "@/components/map/PostClaimNavigationProvider";
import { Button } from "@/components/ui/Button";
import {
  isValidNavigationCoords,
  NAVIGATION_PROVIDER_LABELS,
} from "@/lib/map/navigation-urls";

export const CLAIM_NAVIGATE_ACTION_LABEL = "Navigate to spot";
export const CLAIM_CHANGE_NAVIGATION_LABEL = "Change navigation app";

type ClaimNavigationActionsProps = {
  claimId: string;
  latitude: number;
  longitude: number;
  placement?: "primary" | "change";
};

export function openInProviderLabel(providerId: string): string {
  const name =
    providerId in NAVIGATION_PROVIDER_LABELS
      ? NAVIGATION_PROVIDER_LABELS[
          providerId as keyof typeof NAVIGATION_PROVIDER_LABELS
        ]
      : providerId;
  return `Open in ${name}`;
}

export function ClaimNavigationActions({
  claimId,
  latitude,
  longitude,
  placement = "primary",
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

  if (placement === "change") {
    if (!providerSelected) {
      return null;
    }
    return (
      <button
        type="button"
        data-testid="claim-navigation-change"
        className="self-center text-xs font-medium text-muted underline-offset-2 hover:text-foreground hover:underline"
        onClick={() => {
          navigation.openManual({
            claimId,
            latitude: coords.latitude,
            longitude: coords.longitude,
          });
        }}
      >
        {CLAIM_CHANGE_NAVIGATION_LABEL}
      </button>
    );
  }

  const label =
    providerSelected && selectedProviderId
      ? openInProviderLabel(selectedProviderId)
      : CLAIM_NAVIGATE_ACTION_LABEL;

  return (
    <Button
      type="button"
      data-testid="claim-navigation-action"
      className="w-full !min-h-[var(--app-tap-min)] text-base font-semibold"
      aria-haspopup={providerSelected ? undefined : "dialog"}
      aria-expanded={
        providerSelected
          ? undefined
          : Boolean(navigation.session?.open && sessionMatchesClaim)
      }
      onClick={() => {
        if (providerSelected && navigation.relaunchSelected()) {
          return;
        }
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
