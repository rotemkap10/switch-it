import { PASSWORD_RESET_PATH } from "@/lib/auth/password-recovery";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";
import type { AuthenticatedVehicleStatus } from "@/lib/auth/vehicle-status";

export const VEHICLE_ONBOARDING_PATH = "/onboarding/vehicle";

export function resolvePostAuthRedirect(
  status: AuthenticatedVehicleStatus,
  next?: string | null,
): string {
  const safeNext = getSafeRedirectPath(next);

  // Password recovery must reach set-new-password before onboarding/map.
  if (safeNext === PASSWORD_RESET_PATH) {
    return PASSWORD_RESET_PATH;
  }

  if (status.vehicleComplete) {
    return safeNext;
  }

  if (status.hasActiveSeekerClaim) {
    return "/map";
  }

  if (status.hasActivePublisherSpot) {
    return "/spots/new";
  }

  if (
    safeNext === VEHICLE_ONBOARDING_PATH ||
    safeNext === "/profile" ||
    safeNext === "/help"
  ) {
    return safeNext;
  }

  return VEHICLE_ONBOARDING_PATH;
}
