import type { SupabaseClient } from "@supabase/supabase-js";

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
};

const VEHICLE_SELECT =
  "license_plate, vehicle_make, vehicle_model, vehicle_color, vehicle_type";

export async function getAuthenticatedVehicleStatus(
  supabase: SupabaseClient,
  userId: string,
): Promise<AuthenticatedVehicleStatus> {
  const [profileResult, activeClaimResult, openSpotResult] = await Promise.all([
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
  ]);

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
}
