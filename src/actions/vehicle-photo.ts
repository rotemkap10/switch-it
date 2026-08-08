"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/require-user";
import { mapAppError } from "@/lib/feedback/error-map";
import {
  buildVehiclePhotoPath,
  isOwnVehiclePhotoPath,
  validateVehiclePhotoFile,
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

export async function uploadVehiclePhoto(
  formData: FormData,
): Promise<VehiclePhotoActionState> {
  const file = formData.get("photo");
  if (!(file instanceof File)) {
    return { error: VEHICLE_PHOTO_UNSUPPORTED_MESSAGE };
  }

  const parsed = validateVehiclePhotoFile(file);
  if (!parsed.ok) {
    return { error: parsed.message };
  }

  const { supabase, user } = await requireUser();
  const nextPath = buildVehiclePhotoPath(user.id, parsed.extension);

  const { data: current } = await supabase
    .from("profiles")
    .select("vehicle_photo_path")
    .eq("id", user.id)
    .maybeSingle();
  const previousPath =
    typeof current?.vehicle_photo_path === "string"
      ? current.vehicle_photo_path
      : null;

  const { error: uploadError } = await supabase.storage
    .from(VEHICLE_PHOTO_BUCKET)
    .upload(nextPath, file, {
      contentType: parsed.contentType,
      upsert: false,
    });

  if (uploadError) {
    const mapped = mapAppError(uploadError, "Could not upload your vehicle photo.");
    return { error: mapped.message, errorCode: mapped.code };
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ vehicle_photo_path: nextPath })
    .eq("id", user.id);

  if (updateError) {
    await supabase.storage.from(VEHICLE_PHOTO_BUCKET).remove([nextPath]);
    const mapped = mapAppError(
      updateError,
      "Could not save your vehicle photo.",
    );
    return { error: mapped.message, errorCode: mapped.code };
  }

  if (previousPath && previousPath !== nextPath) {
    await supabase.storage.from(VEHICLE_PHOTO_BUCKET).remove([previousPath]);
  }

  const photoUrl = await createVehiclePhotoSignedUrl(supabase, nextPath);
  revalidateVehiclePhotoPaths();

  return {
    success: true,
    photoPath: nextPath,
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
