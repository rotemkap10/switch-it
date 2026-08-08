"use client";

import { useOptionalPostClaimNavigation } from "@/components/map/PostClaimNavigationProvider";
import { Button } from "@/components/ui/Button";
import { isValidNavigationCoords } from "@/lib/map/navigation-urls";

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
  fullWidth = false,
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

  return (
    <Button
      type="button"
      variant="primary"
      className={fullWidth ? "w-full min-h-12" : "w-full min-h-12 sm:w-fit"}
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
      Open in
    </Button>
  );
}
