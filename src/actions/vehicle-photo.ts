"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/require-user";
import { mapAppError } from "@/lib/feedback/error-map";
import {
  isOwnVehiclePhotoPath,
  VEHICLE_PHOTO_BUCKET,
  VEHICLE_PHOTO_UNSUPPORTED_MESSAGE,
} from "@/lib/vehicle/photo";
import { createVehiclePhotoSignedUrl } from "@/lib/vehicle/signed-photo-url";

export type VehiclePhotoActionState = {
  error?: string;
  errorCode?: string;
  success?: boolean;
  photoPath?: string | null;
  photoUrl?: string | null;
};

function revalidateVehiclePhotoPaths() {
  revalidatePath("/profile");
  revalidatePath("/onboarding/vehicle");
  revalidatePath("/map");
  revalidatePath("/spots/new");
}

/**
 * Commits a storage path that was already uploaded from the browser.
 * Does not accept image bytes — keeps this action well under the 1 MB
 * Next.js Server Action body limit.
 */
export async function saveVehiclePhotoPath(
  photoPath: string,
): Promise<VehiclePhotoActionState> {
  const { supabase, user } = await requireUser();

  if (!isOwnVehiclePhotoPath(user.id, photoPath)) {
    return { error: VEHICLE_PHOTO_UNSUPPORTED_MESSAGE };
  }

  const { data: current } = await supabase
    .from("profiles")
    .select("vehicle_photo_path")
    .eq("id", user.id)
    .maybeSingle();
  const previousPath =
    typeof current?.vehicle_photo_path === "string"
      ? current.vehicle_photo_path
      : null;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ vehicle_photo_path: photoPath })
    .eq("id", user.id);

  if (updateError) {
    const mapped = mapAppError(
      updateError,
      "Could not save your vehicle photo.",
    );
    return { error: mapped.message, errorCode: mapped.code };
  }

  if (previousPath && previousPath !== photoPath) {
    await supabase.storage.from(VEHICLE_PHOTO_BUCKET).remove([previousPath]);
  }

  const photoUrl = await createVehiclePhotoSignedUrl(supabase, photoPath);
  revalidateVehiclePhotoPaths();

  return {
    success: true,
    photoPath,
    photoUrl,
  };
}

export async function removeVehiclePhoto(): Promise<VehiclePhotoActionState> {
  const { supabase, user } = await requireUser();

  const { data: current } = await supabase
    .from("profiles")
    .select("vehicle_photo_path")
    .eq("id", user.id)
    .maybeSingle();
  const previousPath =
    typeof current?.vehicle_photo_path === "string"
      ? current.vehicle_photo_path
      : null;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ vehicle_photo_path: null })
    .eq("id", user.id);

  if (updateError) {
    const mapped = mapAppError(
      updateError,
      "Could not remove your vehicle photo.",
    );
    return { error: mapped.message, errorCode: mapped.code };
  }

  if (previousPath && isOwnVehiclePhotoPath(user.id, previousPath)) {
    await supabase.storage.from(VEHICLE_PHOTO_BUCKET).remove([previousPath]);
  }

  revalidateVehiclePhotoPaths();

  return {
    success: true,
    photoPath: null,
    photoUrl: null,
  };
}
