"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuthenticatedVehicleAccess } from "@/lib/auth/vehicle-access";
import { mapAppError } from "@/lib/feedback/error-map";
import { flattenFieldErrors } from "@/lib/feedback/flatten-field-errors";
import { withFeedbackQuery } from "@/lib/feedback/success-keys";
import { updateVehicleSchema } from "@/lib/validations/vehicle";

export type OnboardingVehicleActionState = {
  error?: string;
  errorCode?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function completeVehicleOnboarding(
  _prevState: OnboardingVehicleActionState,
  formData: FormData,
): Promise<OnboardingVehicleActionState> {
  const parsed = updateVehicleSchema.safeParse({
    license_plate: String(formData.get("license_plate") ?? ""),
    vehicle_make: String(formData.get("vehicle_make") ?? ""),
    vehicle_model: String(formData.get("vehicle_model") ?? ""),
    vehicle_year: String(formData.get("vehicle_year") ?? ""),
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
      vehicle_year: vehicle.vehicle_year,
      vehicle_color: vehicle.vehicle_color,
      vehicle_type: vehicle.vehicle_type,
    })
    .eq("id", user.id);

  if (error) {
    const mapped = mapAppError(error, "Could not save your vehicle details.");
    return { error: mapped.message, errorCode: mapped.code };
  }

  revalidatePath("/onboarding/vehicle");
  revalidatePath("/profile");
  revalidatePath("/map");
  revalidatePath("/spots/new");

  redirect(withFeedbackQuery("/map", "vehicle-added"));
}
