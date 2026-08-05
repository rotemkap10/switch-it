"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/require-user";
import { assertVehicleProfileCompleteForMutation } from "@/lib/auth/vehicle-access";
import {
  cancelClaimSchema,
  claimSpotSchema,
  completeClaimSchema,
} from "@/lib/validations/claim";

export type ClaimSpotActionState = {
  error?: string;
  success?: boolean;
  claimId?: string;
  claimExpiresAt?: string;
};

export type CompleteClaimActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
  claimId?: string;
  seekerCredits?: number;
  alreadyCompleted?: boolean;
  lockout?: boolean;
};

export type CancelClaimActionState = {
  error?: string;
  success?: boolean;
  alreadyCancelled?: boolean;
};

const CLAIM_SPOT_ERROR_MESSAGES: Record<string, string> = {
  SPOT_NOT_FOUND: "Parking spot not found.",
  SPOT_EXPIRED: "This parking spot has expired.",
  SPOT_UNAVAILABLE: "This parking spot was already claimed.",
  SELF_CLAIM: "You cannot claim your own parking spot.",
  INSUFFICIENT_CREDITS: "You need at least 1 credit to claim a spot.",
  ACTIVE_CLAIM_EXISTS: "You already have an active claim.",
  NOT_AUTHENTICATED: "Could not claim parking spot.",
};

const COMPLETE_CLAIM_ERROR_MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: "Could not complete the handoff.",
  CLAIM_NOT_FOUND: "Claim not found.",
  NOT_SEEKER: "Only the claiming driver can complete this handoff.",
  CLAIM_NOT_ACTIVE: "This claim cannot be completed.",
  CLAIM_EXPIRED: "This handoff is no longer available.",
  SPOT_UNAVAILABLE: "This handoff is no longer available.",
  HANDOFF_UNAVAILABLE: "This handoff is no longer available.",
  INVALID_HANDOFF_CODE: "That code didn't match. Check with the driver and try again.",
  HANDOFF_TEMPORARILY_LOCKED: "Too many attempts. Try again shortly.",
  INSUFFICIENT_CREDITS: "You need at least 1 credit to complete this handoff.",
  PROFILE_NOT_FOUND: "Could not complete the handoff.",
  INCONSISTENT_COMPLETION_STATE: "This handoff is in an inconsistent state.",
};

function flattenFieldErrors(
  error: import("zod").ZodError,
): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key !== "string") continue;
    fieldErrors[key] ??= [];
    fieldErrors[key].push(issue.message);
  }
  return fieldErrors;
}

const CANCEL_CLAIM_ERROR_MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: "Could not cancel this claim.",
  CLAIM_NOT_FOUND: "Claim not found.",
  NOT_SEEKER: "Only the claiming driver can cancel this claim.",
  CLAIM_NOT_ACTIVE: "This claim cannot be cancelled.",
  SPOT_NOT_FOUND: "Parking spot not found.",
  INCONSISTENT_STATE: "Could not update this handoff.",
};

function mapRpcError(
  error: {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  },
  messages: Record<string, string>,
  fallback: string,
): string {
  const haystack = [error.message, error.details, error.hint]
    .filter(Boolean)
    .join(" ");

  for (const code of Object.keys(messages)) {
    if (haystack.includes(code)) {
      return messages[code];
    }
  }

  if (error.code === "23505") {
    if (haystack.includes("claims_one_active_per_spot")) {
      return (
        CLAIM_SPOT_ERROR_MESSAGES.SPOT_UNAVAILABLE ??
        "This parking spot was already claimed."
      );
    }
    if (haystack.includes("claims_one_active_per_seeker")) {
      return (
        CLAIM_SPOT_ERROR_MESSAGES.ACTIVE_CLAIM_EXISTS ??
        "You already have an active claim."
      );
    }
    if (
      haystack.includes("credit_tx_one_debit_per_claim") ||
      haystack.includes("credit_tx_one_credit_per_claim")
    ) {
      return (
        COMPLETE_CLAIM_ERROR_MESSAGES.INCONSISTENT_COMPLETION_STATE ??
        "This handoff is in an inconsistent state."
      );
    }
  }

  return fallback;
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

  const { supabase, user } = await requireUser();

  const vehicleCheck = await assertVehicleProfileCompleteForMutation(
    supabase,
    user.id,
  );
  if (!vehicleCheck.ok) {
    return {
      error: "Add your vehicle in your profile before claiming a parking spot.",
    };
  }

  const { data, error } = await supabase.rpc("claim_spot", {
    p_spot_id: parsed.data.spot_id,
  });

  if (error) {
    return {
      error: mapRpcError(
        error,
        CLAIM_SPOT_ERROR_MESSAGES,
        "Could not claim parking spot.",
      ),
    };
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
    const haystack = [error.message, error.details, error.hint]
      .filter(Boolean)
      .join(" ");

    if (haystack.includes("HANDOFF_TEMPORARILY_LOCKED")) {
      return {
        error: COMPLETE_CLAIM_ERROR_MESSAGES.HANDOFF_TEMPORARILY_LOCKED,
        lockout: true,
      };
    }

    return {
      error: mapRpcError(
        error,
        COMPLETE_CLAIM_ERROR_MESSAGES,
        "Could not complete the handoff.",
      ),
    };
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (
    !row ||
    typeof row !== "object" ||
    typeof (row as { claim_id?: unknown }).claim_id !== "string" ||
    typeof (row as { seeker_credits?: unknown }).seeker_credits !== "number"
  ) {
    return { error: "Could not complete the handoff." };
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
    return { error: "Could not cancel this claim." };
  }

  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("cancel_claim", {
    p_claim_id: parsed.data.claim_id,
  });

  if (error) {
    return {
      error: mapRpcError(
        error,
        CANCEL_CLAIM_ERROR_MESSAGES,
        "Could not cancel this claim.",
      ),
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    return { error: "Could not cancel this claim." };
  }

  revalidatePath("/map");

  return {
    success: true,
    alreadyCancelled: Boolean(
      (row as { already_cancelled?: boolean }).already_cancelled,
    ),
  };
}
