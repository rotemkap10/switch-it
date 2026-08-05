import { redirect } from "next/navigation";

import {
  getAuthenticatedVehicleStatus,
  type AuthenticatedVehicleStatus,
} from "@/lib/auth/vehicle-status";
import { VEHICLE_ONBOARDING_PATH } from "@/lib/auth/post-auth-redirect";
import { requireUser } from "@/lib/auth/require-user";

export type VehicleAccessMode =
  | "require-complete"
  | "allow-incomplete"
  | "onboarding-only";

export type VehicleHandoffException =
  | "active-seeker"
  | "active-publisher"
  | null;

export async function requireAuthenticatedVehicleAccess(options: {
  mode: VehicleAccessMode;
  handoffException?: VehicleHandoffException;
}): Promise<{
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"];
  user: Awaited<ReturnType<typeof requireUser>>["user"];
  status: AuthenticatedVehicleStatus;
}> {
  const { supabase, user } = await requireUser();
  const status = await getAuthenticatedVehicleStatus(supabase, user.id);

  if (options.mode === "onboarding-only") {
    if (status.vehicleComplete) {
      redirect("/map");
    }
    return { supabase, user, status };
  }

  if (options.mode === "allow-incomplete") {
    return { supabase, user, status };
  }

  if (status.vehicleComplete) {
    return { supabase, user, status };
  }

  const allowedByHandoff =
    (options.handoffException === "active-seeker" &&
      status.hasActiveSeekerClaim) ||
    (options.handoffException === "active-publisher" &&
      status.hasActivePublisherSpot);

  if (allowedByHandoff) {
    return { supabase, user, status };
  }

  redirect(VEHICLE_ONBOARDING_PATH);
}

export async function assertVehicleProfileCompleteForMutation(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
): Promise<{ ok: true } | { ok: false; code: "VEHICLE_PROFILE_REQUIRED" }> {
  const status = await getAuthenticatedVehicleStatus(supabase, userId);
  if (!status.vehicleComplete) {
    return { ok: false, code: "VEHICLE_PROFILE_REQUIRED" };
  }
  return { ok: true };
}
