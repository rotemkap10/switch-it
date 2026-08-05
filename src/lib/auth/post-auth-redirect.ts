import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";
import type { AuthenticatedVehicleStatus } from "@/lib/auth/vehicle-status";

export const VEHICLE_ONBOARDING_PATH = "/onboarding/vehicle";

export function resolvePostAuthRedirect(
  status: AuthenticatedVehicleStatus,
  next?: string | null,
): string {
  if (status.vehicleComplete) {
    return getSafeRedirectPath(next);
  }

  if (status.hasActiveSeekerClaim) {
    return "/map";
  }

  if (status.hasActivePublisherSpot) {
    return "/spots/new";
  }

  const safeNext = getSafeRedirectPath(next);
  if (
    safeNext === VEHICLE_ONBOARDING_PATH ||
    safeNext === "/profile"
  ) {
    return safeNext;
  }

  return VEHICLE_ONBOARDING_PATH;
}
