"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/require-user";
import { updateDisplayNameSchema } from "@/lib/validations/profile";
import { updateVehicleSchema } from "@/lib/validations/vehicle";

export type ProfileActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
  displayName?: string;
};

export type VehicleActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
  vehicle?: {
    license_plate: string | null;
    vehicle_make: string | null;
    vehicle_model: string | null;
    vehicle_color: string | null;
    vehicle_type: string | null;
  } | null;
};

function flattenFieldErrors(
  error: import("zod").ZodError,
): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key !== "string") continue;
    fieldErrors[key] ??= [];
    fieldErrors[key].push(issue.message);
  }
  return fieldErrors;
}

export async function updateDisplayName(
  _prevState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const parsed = updateDisplayNameSchema.safeParse({
    display_name: formData.get("display_name"),
  });

  if (!parsed.success) {
    return { fieldErrors: flattenFieldErrors(parsed.error) };
  }

  const { display_name } = parsed.data;
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("profiles")
    .update({ display_name })
    .eq("id", user.id)
    .select("display_name")
    .single();

  if (error || !data) {
    return { error: "Could not update display name." };
  }

  revalidatePath("/profile");

  return {
    success: true,
    displayName: data.display_name,
  };
}

export async function updateVehicle(
  _prevState: VehicleActionState,
  formData: FormData,
): Promise<VehicleActionState> {
  const parsed = updateVehicleSchema.safeParse({
    license_plate: String(formData.get("license_plate") ?? ""),
    vehicle_make: String(formData.get("vehicle_make") ?? ""),
    vehicle_model: String(formData.get("vehicle_model") ?? ""),
    vehicle_color: String(formData.get("vehicle_color") ?? ""),
    vehicle_type: String(formData.get("vehicle_type") ?? ""),
  });

  if (!parsed.success) {
    return { fieldErrors: flattenFieldErrors(parsed.error) };
  }

  const { supabase, user } = await requireUser();
  const vehicle = parsed.data;
  const completeSetup = formData.get("complete_setup") === "1";

  const { data, error } = await supabase
    .from("profiles")
    .update({
      license_plate: vehicle.license_plate,
      vehicle_make: vehicle.vehicle_make,
      vehicle_model: vehicle.vehicle_model,
      vehicle_color: vehicle.vehicle_color,
      vehicle_type: vehicle.vehicle_type,
    })
    .eq("id", user.id)
    .select(
      "license_plate, vehicle_make, vehicle_model, vehicle_color, vehicle_type",
    )
    .single();

  if (error || !data) {
    return { error: "Could not update vehicle details." };
  }

  revalidatePath("/profile");
  revalidatePath("/onboarding/vehicle");
  revalidatePath("/map");
  revalidatePath("/spots/new");

  if (completeSetup) {
    redirect("/map");
  }

  return {
    success: true,
    vehicle: data,
  };
}
