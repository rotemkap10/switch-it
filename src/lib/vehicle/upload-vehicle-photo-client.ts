import { APP_ERROR_MESSAGES, mapAppError } from "@/lib/feedback/error-map";
import { createClient } from "@/lib/supabase/client";
import {
  buildVehiclePhotoPath,
  validateVehiclePhotoForUpload,
  VEHICLE_PHOTO_BUCKET,
  VEHICLE_PHOTO_TIMEOUT_MESSAGE,
  VEHICLE_PHOTO_UPLOAD_TIMEOUT_MS,
  withVehiclePhotoTimeout,
} from "@/lib/vehicle/photo";

export type DirectVehiclePhotoUploadResult =
  | { ok: true; photoPath: string }
  | { ok: false; error: string };

/**
 * Uploads the selected image directly to private Supabase Storage using the
 * authenticated browser client + RLS. Does not proxy bytes through Next.js.
 */
export async function uploadVehiclePhotoToStorage(
  file: File,
  options?: { timeoutMs?: number },
): Promise<DirectVehiclePhotoUploadResult> {
  const parsed = await validateVehiclePhotoForUpload(file);
  if (!parsed.ok) {
    return { ok: false, error: parsed.message };
  }

  try {
    return await withVehiclePhotoTimeout(
      (async () => {
        const supabase = createClient();
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          return { ok: false, error: APP_ERROR_MESSAGES.NOT_AUTHENTICATED };
        }

        const photoPath = buildVehiclePhotoPath(user.id, parsed.extension);
        const { error: uploadError } = await supabase.storage
          .from(VEHICLE_PHOTO_BUCKET)
          .upload(photoPath, file, {
            contentType: parsed.contentType,
            upsert: false,
          });

        if (uploadError) {
          const mapped = mapAppError(
            uploadError,
            "Could not upload your vehicle photo.",
          );
          return { ok: false, error: mapped.message };
        }

        return { ok: true, photoPath };
      })(),
      options?.timeoutMs ?? VEHICLE_PHOTO_UPLOAD_TIMEOUT_MS,
    );
  } catch (error) {
    if (error instanceof Error && error.message === VEHICLE_PHOTO_TIMEOUT_MESSAGE) {
      return { ok: false, error: VEHICLE_PHOTO_TIMEOUT_MESSAGE };
    }
    return {
      ok: false,
      error: mapAppError(
        error instanceof Error ? error.message : undefined,
        "Could not upload your vehicle photo.",
      ).message,
    };
  }
}

export async function removeUploadedVehiclePhoto(photoPath: string): Promise<void> {
  try {
    const supabase = createClient();
    await supabase.storage.from(VEHICLE_PHOTO_BUCKET).remove([photoPath]);
  } catch {
    // Best-effort orphan cleanup.
  }
}
