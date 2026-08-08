import type { SupabaseClient } from "@supabase/supabase-js";

import { VEHICLE_PHOTO_BUCKET } from "@/lib/vehicle/photo";

const DEFAULT_EXPIRES_IN = 60 * 60;

export async function createVehiclePhotoSignedUrl(
  supabase: SupabaseClient,
  path: string | null | undefined,
  expiresIn = DEFAULT_EXPIRES_IN,
): Promise<string | null> {
  if (!path) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from(VEHICLE_PHOTO_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}
