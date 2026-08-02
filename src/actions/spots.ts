"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/require-user";
import { publishSpotSchema } from "@/lib/validations/spot";

export type PublishSpotActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

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
    available_at: formData.get("available_at"),
    expires_at: formData.get("expires_at"),
  });

  if (!parsed.success) {
    return { fieldErrors: flattenFieldErrors(parsed.error) };
  }

  const { supabase, user } = await requireUser();
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
  redirect("/map");
}
