"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/require-user";
import { assertVehicleProfileCompleteForMutation } from "@/lib/auth/vehicle-access";
import {
  APP_ERROR_MESSAGES,
  GENERIC_APP_ERROR,
  mapAppError,
} from "@/lib/feedback/error-map";
import { flattenFieldErrors } from "@/lib/feedback/flatten-field-errors";
import { withFeedbackQuery } from "@/lib/feedback/success-keys";
import { computeSpotAvailabilityWindow } from "@/lib/spots/constants";
import { cancelSpotSchema } from "@/lib/validations/claim";
import { publishSpotSchema } from "@/lib/validations/spot";

export type PublishSpotActionState = {
  error?: string;
  errorCode?: string;
  fieldErrors?: Record<string, string[]>;
};

export type CancelSpotActionState = {
  error?: string;
  errorCode?: string;
  success?: boolean;
  alreadyCancelled?: boolean;
};

export async function publishSpot(
  _prevState: PublishSpotActionState,
  formData: FormData,
): Promise<PublishSpotActionState> {
  const parsed = publishSpotSchema.safeParse({
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
    address: formData.get("address") ?? "",
    available_in_minutes: formData.get("available_in_minutes"),
  });

  if (!parsed.success) {
    return { fieldErrors: flattenFieldErrors(parsed.error) };
  }

  const { supabase, user } = await requireUser();

  const vehicleCheck = await assertVehicleProfileCompleteForMutation(
    supabase,
    user.id,
  );
  if (!vehicleCheck.ok) {
    return {
      error: APP_ERROR_MESSAGES.VEHICLE_PROFILE_REQUIRED,
      errorCode: "VEHICLE_PROFILE_REQUIRED",
    };
  }

  const { latitude, longitude, address, available_in_minutes } = parsed.data;

  // Authoritative server clock — never trust a client absolute timestamp.
  const { available_at, expires_at } = computeSpotAvailabilityWindow(
    available_in_minutes,
    new Date(),
  );

  const { data, error } = await supabase
    .from("parking_spots")
    .insert({
      owner_id: user.id,
      latitude,
      longitude,
      address,
      available_at,
      expires_at,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return {
        error: APP_ERROR_MESSAGES.OPEN_SPOT_EXISTS,
        errorCode: "OPEN_SPOT_EXISTS",
      };
    }

    const mapped = mapAppError(error, "Could not publish parking spot.");
    return { error: mapped.message, errorCode: mapped.code };
  }

  revalidatePath("/map");
  revalidatePath("/spots/new");
  redirect(withFeedbackQuery("/spots/new", "spot-published"));
}

export async function cancelSpot(
  _prevState: CancelSpotActionState,
  formData: FormData,
): Promise<CancelSpotActionState> {
  const parsed = cancelSpotSchema.safeParse({
    spot_id: formData.get("spot_id"),
  });

  if (!parsed.success) {
    return {
      error: GENERIC_APP_ERROR,
      errorCode: "UNKNOWN",
    };
  }

  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("cancel_spot", {
    p_spot_id: parsed.data.spot_id,
  });

  if (error) {
    const mapped = mapAppError(error, "Could not cancel this parking spot.");
    return { error: mapped.message, errorCode: mapped.code };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    return { error: GENERIC_APP_ERROR, errorCode: "UNKNOWN" };
  }

  revalidatePath("/map");
  revalidatePath("/spots/new");

  return {
    success: true,
    alreadyCancelled: Boolean(
      (row as { already_cancelled?: boolean }).already_cancelled,
    ),
  };
}
