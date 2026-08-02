"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/require-user";
import { claimSpotSchema } from "@/lib/validations/claim";

export type ClaimSpotActionState = {
  error?: string;
  success?: boolean;
  claimId?: string;
  claimExpiresAt?: string;
};

const BUSINESS_ERROR_MESSAGES: Record<string, string> = {
  SPOT_NOT_FOUND: "Parking spot not found.",
  SPOT_EXPIRED: "This parking spot has expired.",
  SPOT_UNAVAILABLE: "This parking spot was already claimed.",
  SELF_CLAIM: "You cannot claim your own parking spot.",
  INSUFFICIENT_CREDITS: "You need at least 1 credit to claim a spot.",
  ACTIVE_CLAIM_EXISTS: "You already have an active claim.",
  NOT_AUTHENTICATED: "Could not claim parking spot.",
};

function mapClaimError(error: {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}): string {
  const haystack = [error.message, error.details, error.hint]
    .filter(Boolean)
    .join(" ");

  for (const code of Object.keys(BUSINESS_ERROR_MESSAGES)) {
    if (haystack.includes(code)) {
      return BUSINESS_ERROR_MESSAGES[code];
    }
  }

  if (error.code === "23505") {
    if (haystack.includes("claims_one_active_per_spot")) {
      return BUSINESS_ERROR_MESSAGES.SPOT_UNAVAILABLE;
    }
    if (haystack.includes("claims_one_active_per_seeker")) {
      return BUSINESS_ERROR_MESSAGES.ACTIVE_CLAIM_EXISTS;
    }
  }

  return "Could not claim parking spot.";
}

export async function claimSpot(
  _prevState: ClaimSpotActionState,
  formData: FormData,
): Promise<ClaimSpotActionState> {
  const parsed = claimSpotSchema.safeParse({
    spot_id: formData.get("spot_id"),
  });

  if (!parsed.success) {
    return { error: "Could not claim parking spot." };
  }

  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("claim_spot", {
    p_spot_id: parsed.data.spot_id,
  });

  if (error) {
    return { error: mapClaimError(error) };
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (
    !row ||
    typeof row !== "object" ||
    typeof (row as { claim_id?: unknown }).claim_id !== "string"
  ) {
    return { error: "Could not claim parking spot." };
  }

  const result = row as {
    claim_id: string;
    spot_id: string;
    claim_expires_at: string;
  };

  revalidatePath("/map");

  return {
    success: true,
    claimId: result.claim_id,
    claimExpiresAt: result.claim_expires_at,
  };
}
