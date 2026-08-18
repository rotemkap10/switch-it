"use server";

import { requireUser } from "@/lib/auth/require-user";
import { runHandoffAction } from "@/lib/feedback/action-recovery";
import { GENERIC_APP_ERROR, mapAppError } from "@/lib/feedback/error-map";
import { reconcileClaimTimingSchema } from "@/lib/validations/claim";

export type ReconcileClaimTimingState = {
  error?: string;
  errorCode?: string;
  success?: boolean;
  changed?: boolean;
};

/**
 * Persist due-state for an active claimed handoff (auto-start at available_at,
 * or expire if the window already ended). Does not revalidate — Realtime and
 * the existing RSC reconciliation poll converge the UI.
 */
export async function reconcileClaimTiming(
  claimId: string,
): Promise<ReconcileClaimTimingState> {
  const parsed = reconcileClaimTimingSchema.safeParse({ claim_id: claimId });
  if (!parsed.success) {
    return { error: GENERIC_APP_ERROR, errorCode: "UNKNOWN" };
  }

  return runHandoffAction(
    "reconcile_claim_timing",
    "Could not update the handoff.",
    { claimId: parsed.data.claim_id },
    async () => {
      const { supabase } = await requireUser();
      const { data, error } = await supabase.rpc("expire_claim_if_needed", {
        p_claim_id: parsed.data.claim_id,
      });

      if (error) {
        const mapped = mapAppError(error, "Could not update the handoff.");
        return { error: mapped.message, errorCode: mapped.code };
      }

      const row = Array.isArray(data) ? data[0] : data;
      const changed =
        row &&
        typeof row === "object" &&
        (row as { changed?: unknown }).changed === true;

      return { success: true, changed };
    },
  );
}
