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
import { shouldRevalidateMapAfterClaimFailure } from "@/lib/map/stale-discovery-errors";
import {
  cancelClaimSchema,
  claimSpotSchema,
  completeClaimSchema,
  extendHandoffWaitSchema,
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

export type ExtendHandoffWaitActionState = {
  error?: string;
  errorCode?: string;
  success?: boolean;
  changed?: boolean;
  expiresAt?: string;
  hardCapAt?: string;
  extendedBySeconds?: number;
};

export async function claimSpot(
  _prevState: ClaimSpotActionState,
  formData: FormData,
): Promise<ClaimSpotActionState> {
  const parsed = claimSpotSchema.safeParse({
    spot_id: formData.get("spot_id"),
    seeker_latitude: formData.get("seeker_latitude"),
    seeker_longitude: formData.get("seeker_longitude"),
  });

  if (!parsed.success) {
    const locationIssue = parsed.error.issues.some(
      (issue) =>
        issue.path[0] === "seeker_latitude" ||
        issue.path[0] === "seeker_longitude",
    );
    if (locationIssue) {
      return {
        error: APP_ERROR_MESSAGES.LOCATION_REQUIRED,
        errorCode: "LOCATION_REQUIRED",
      };
    }
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
    p_seeker_latitude: parsed.data.seeker_latitude,
    p_seeker_longitude: parsed.data.seeker_longitude,
  });

  if (error) {
    const mapped = mapAppError(error, "Could not claim parking spot.");
    if (shouldRevalidateMapAfterClaimFailure(mapped.code)) {
      revalidatePath("/map");
    }
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

export async function extendHandoffWait(
  _prevState: ExtendHandoffWaitActionState,
  formData: FormData,
): Promise<ExtendHandoffWaitActionState> {
  const parsed = extendHandoffWaitSchema.safeParse({
    claim_id: formData.get("claim_id"),
  });

  if (!parsed.success) {
    return { error: GENERIC_APP_ERROR, errorCode: "UNKNOWN" };
  }

  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("extend_handoff_wait", {
    p_claim_id: parsed.data.claim_id,
  });

  if (error) {
    const mapped = mapAppError(error, "Could not extend the handoff wait.");
    return { error: mapped.message, errorCode: mapped.code };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (
    !row ||
    typeof row !== "object" ||
    typeof (row as { expires_at?: unknown }).expires_at !== "string"
  ) {
    return { error: GENERIC_APP_ERROR, errorCode: "UNKNOWN" };
  }

  const result = row as {
    claim_id: string;
    spot_id: string;
    expires_at: string;
    hard_cap_at: string;
    extended_by_seconds: number;
    changed: boolean;
  };

  revalidatePath("/spots/new");
  revalidatePath("/map");

  return {
    success: true,
    changed: Boolean(result.changed),
    expiresAt: result.expires_at,
    hardCapAt: result.hard_cap_at,
    extendedBySeconds:
      typeof result.extended_by_seconds === "number"
        ? result.extended_by_seconds
        : 0,
  };
}
