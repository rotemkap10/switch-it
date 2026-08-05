"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/require-user";
import { assertVehicleProfileCompleteForMutation } from "@/lib/auth/vehicle-access";
import { cancelSpotSchema } from "@/lib/validations/claim";
import { publishSpotSchema } from "@/lib/validations/spot";

export type PublishSpotActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

export type CancelSpotActionState = {
  error?: string;
  success?: boolean;
  alreadyCancelled?: boolean;
};

const CANCEL_SPOT_ERROR_MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: "Could not cancel this parking spot.",
  SPOT_NOT_FOUND: "Parking spot not found.",
  NOT_OWNER: "Only the publisher can cancel this spot.",
  SPOT_NOT_CANCELLABLE: "This spot can no longer be cancelled.",
  ACTIVE_CLAIM_NOT_FOUND: "No active claim found for this spot.",
  INCONSISTENT_STATE: "Could not update this parking spot.",
};

function mapCancelSpotError(error: {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}): string {
  const haystack = [error.message, error.details, error.hint]
    .filter(Boolean)
    .join(" ");

  for (const code of Object.keys(CANCEL_SPOT_ERROR_MESSAGES)) {
    if (haystack.includes(code)) {
      return CANCEL_SPOT_ERROR_MESSAGES[code];
    }
  }

  return "Could not cancel this parking spot.";
}

function flattenFieldErrors(
  error: import("zod").ZodError,
): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    fieldErrors[key] ??= [];
    fieldErrors[key].push(issue.message);
  }
  return fieldErrors;
}

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
      error:
        "Add your vehicle in your profile before publishing a parking spot.",
    };
  }

  const { latitude, longitude, address, available_at, expires_at } =
    parsed.data;

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
      return { error: "You already have an active parking spot." };
    }

    return { error: "Could not publish parking spot." };
  }

  revalidatePath("/map");
  revalidatePath("/spots/new");
  redirect("/spots/new");
}

export async function cancelSpot(
  _prevState: CancelSpotActionState,
  formData: FormData,
): Promise<CancelSpotActionState> {
  const parsed = cancelSpotSchema.safeParse({
    spot_id: formData.get("spot_id"),
  });

  if (!parsed.success) {
    return { error: "Could not cancel this parking spot." };
  }

  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("cancel_spot", {
    p_spot_id: parsed.data.spot_id,
  });

  if (error) {
    return { error: mapCancelSpotError(error) };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    return { error: "Could not cancel this parking spot." };
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
