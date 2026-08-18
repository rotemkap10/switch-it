import type { SupabaseClient } from "@supabase/supabase-js";

import { logRecoverableFailure } from "@/lib/feedback/log-recoverable-failure";
import {
  isVehicleProfileComplete,
  type VehicleProfileFields,
} from "@/lib/vehicle/profile-fields";

export type AuthenticatedVehicleStatus = {
  vehicle: VehicleProfileFields | null;
  vehicleComplete: boolean;
  hasActiveSeekerClaim: boolean;
  hasActivePublisherSpot: boolean;
  hasActiveHandoff: boolean;
  /** True when the status queries threw (network / client) rather than returning rows. */
  statusLoadFailed?: boolean;
};

const VEHICLE_SELECT =
  "license_plate, vehicle_make, vehicle_model, vehicle_year, vehicle_color, vehicle_type";

const FAILED_STATUS: AuthenticatedVehicleStatus = {
  vehicle: null,
  vehicleComplete: false,
  hasActiveSeekerClaim: false,
  hasActivePublisherSpot: false,
  hasActiveHandoff: false,
  statusLoadFailed: true,
};

export async function getAuthenticatedVehicleStatus(
  supabase: SupabaseClient,
  userId: string,
): Promise<AuthenticatedVehicleStatus> {
  try {
    const [profileResult, activeClaimResult, openSpotResult] = await Promise.all(
      [
        supabase
          .from("profiles")
          .select(VEHICLE_SELECT)
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("claims")
          .select("id")
          .eq("seeker_id", userId)
          .eq("status", "active")
          .maybeSingle(),
        supabase
          .from("parking_spots")
          .select("id")
          .eq("owner_id", userId)
          .in("status", ["available", "claimed"])
          .maybeSingle(),
      ],
    );

    const vehicle = profileResult.data ?? null;
    const vehicleComplete = isVehicleProfileComplete(vehicle);
    const hasActiveSeekerClaim = Boolean(activeClaimResult.data?.id);
    const hasActivePublisherSpot = Boolean(openSpotResult.data?.id);

    return {
      vehicle,
      vehicleComplete,
      hasActiveSeekerClaim,
      hasActivePublisherSpot,
      hasActiveHandoff: hasActiveSeekerClaim || hasActivePublisherSpot,
    };
  } catch {
    logRecoverableFailure("vehicle-status", {
      operation: "getAuthenticatedVehicleStatus",
      phase: "render",
    });
    return FAILED_STATUS;
  }
}
