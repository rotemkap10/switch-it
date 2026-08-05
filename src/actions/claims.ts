"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/require-user";
import { assertVehicleProfileCompleteForMutation } from "@/lib/auth/vehicle-access";
import {
  APP_ERROR_MESSAGES,
  GENERIC_APP_ERROR,
  mapAppError,
} from "@/lib/feedback/error-map";
import { flattenFieldErrors } from "@/lib/feedback/flatten-field-errors";
import {
  cancelClaimSchema,
  claimSpotSchema,
  completeClaimSchema,
} from "@/lib/validations/claim";

export type ClaimSpotActionState = {
  error?: string;
  errorCode?: string;
  success?: boolean;
  claimId?: string;
  claimExpiresAt?: string;
};

export type CompleteClaimActionState = {
  error?: string;
  errorCode?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
  claimId?: string;
  seekerCredits?: number;
  alreadyCompleted?: boolean;
  lockout?: boolean;
};

export type CancelClaimActionState = {
  error?: string;
  errorCode?: string;
  success?: boolean;
  alreadyCancelled?: boolean;
};

export async function claimSpot(
  _prevState: ClaimSpotActionState,
  formData: FormData,
): Promise<ClaimSpotActionState> {
  const parsed = claimSpotSchema.safeParse({
    spot_id: formData.get("spot_id"),
  });

  if (!parsed.success) {
    return { error: GENERIC_APP_ERROR, errorCode: "UNKNOWN" };
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

  const { data, error } = await supabase.rpc("claim_spot", {
    p_spot_id: parsed.data.spot_id,
  });

  if (error) {
    const mapped = mapAppError(error, "Could not claim parking spot.");
    return { error: mapped.message, errorCode: mapped.code };
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (
    !row ||
    typeof row !== "object" ||
    typeof (row as { claim_id?: unknown }).claim_id !== "string"
  ) {
    return { error: GENERIC_APP_ERROR, errorCode: "UNKNOWN" };
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

export async function completeClaim(
  _prevState: CompleteClaimActionState,
  formData: FormData,
): Promise<CompleteClaimActionState> {
  const parsed = completeClaimSchema.safeParse({
    claim_id: formData.get("claim_id"),
    handoff_code: formData.get("handoff_code"),
  });

  if (!parsed.success) {
    return { fieldErrors: flattenFieldErrors(parsed.error) };
  }

  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("complete_claim", {
    p_claim_id: parsed.data.claim_id,
    p_handoff_code: parsed.data.handoff_code,
  });

  if (error) {
    const mapped = mapAppError(error, "Could not complete the handoff.");

    if (mapped.code === "HANDOFF_TEMPORARILY_LOCKED") {
      return {
        error: mapped.message,
        errorCode: mapped.code,
        lockout: true,
      };
    }

    return {
      error: mapped.message,
      errorCode: mapped.code,
    };
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (
    !row ||
    typeof row !== "object" ||
    typeof (row as { claim_id?: unknown }).claim_id !== "string" ||
    typeof (row as { seeker_credits?: unknown }).seeker_credits !== "number"
  ) {
    return { error: GENERIC_APP_ERROR, errorCode: "UNKNOWN" };
  }

  const result = row as {
    claim_id: string;
    spot_id: string;
    seeker_credits: number;
    already_completed: boolean;
  };

  revalidatePath("/map");
  revalidatePath("/profile");

  return {
    success: true,
    claimId: result.claim_id,
    seekerCredits: result.seeker_credits,
    alreadyCompleted: Boolean(result.already_completed),
  };
}

export async function cancelClaim(
  _prevState: CancelClaimActionState,
  formData: FormData,
): Promise<CancelClaimActionState> {
  const parsed = cancelClaimSchema.safeParse({
    claim_id: formData.get("claim_id"),
  });

  if (!parsed.success) {
    return { error: GENERIC_APP_ERROR, errorCode: "UNKNOWN" };
  }

  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("cancel_claim", {
    p_claim_id: parsed.data.claim_id,
  });

  if (error) {
    const mapped = mapAppError(error, "Could not cancel this claim.");
    return { error: mapped.message, errorCode: mapped.code };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    return { error: GENERIC_APP_ERROR, errorCode: "UNKNOWN" };
  }

  revalidatePath("/map");

  return {
    success: true,
    alreadyCancelled: Boolean(
      (row as { already_cancelled?: boolean }).already_cancelled,
    ),
  };
}
