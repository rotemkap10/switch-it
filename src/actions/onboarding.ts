"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuthenticatedVehicleAccess } from "@/lib/auth/vehicle-access";
import { updateVehicleSchema } from "@/lib/validations/vehicle";

export type OnboardingVehicleActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
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

export async function completeVehicleOnboarding(
  _prevState: OnboardingVehicleActionState,
  formData: FormData,
): Promise<OnboardingVehicleActionState> {
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

  const { supabase, user } = await requireAuthenticatedVehicleAccess({
    mode: "onboarding-only",
  });
  const vehicle = parsed.data;

  const { error } = await supabase
    .from("profiles")
    .update({
      license_plate: vehicle.license_plate,
      vehicle_make: vehicle.vehicle_make,
      vehicle_model: vehicle.vehicle_model,
      vehicle_color: vehicle.vehicle_color,
      vehicle_type: vehicle.vehicle_type,
    })
    .eq("id", user.id);

  if (error) {
    return { error: "Could not save your vehicle details." };
  }

  revalidatePath("/onboarding/vehicle");
  revalidatePath("/profile");
  revalidatePath("/map");
  revalidatePath("/spots/new");

  redirect("/map");
}
