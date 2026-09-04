"use client";

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

import { presentHandoffCompletionSuccess } from "@/lib/handoff/handoff-completion-success";
import {
  SEEKER_PARKING_SPOT_NO_LONGER_AVAILABLE,
  notifySeekerHandoffTerminal,
} from "@/lib/handoff/seeker-handoff-terminal";
import {
  isRealtimeFeedbackSuppressed,
  realtimeFeedbackKey,
  suppressRealtimeFeedback,
} from "@/lib/realtime/feedback-suppression";
import { sensoryHandoffCompleted } from "@/lib/sensory/feedback";
import { useActiveHandoffReconciliation } from "@/lib/realtime/use-active-handoff-reconciliation";
import { useDebouncedRouterRefresh } from "@/lib/realtime/use-debounced-router-refresh";
import { useRealtimeInvalidation } from "@/lib/realtime/use-realtime-invalidation";

/** @deprecated Use SEEKER_PARKING_SPOT_NO_LONGER_AVAILABLE */
export const SEEKER_CLAIM_CANCELLED_BY_PUBLISHER =
  SEEKER_PARKING_SPOT_NO_LONGER_AVAILABLE;

type MapRealtimeSyncProps = {
  userId: string;
  /** Active claim id when the seeker has one; omit when browsing. */
  activeClaimId?: string | null;
};

function rowStatus(row: Record<string, unknown> | null | undefined): string | null {
  if (!row || typeof row.status !== "string") {
    return null;
  }
  return row.status;
}

function rowId(row: Record<string, unknown> | null | undefined): string | null {
  if (!row || typeof row.id !== "string") {
    return null;
  }
  return row.id;
}

/**
 * Seeker /map Realtime — active claim feedback + invalidation.
 * Discovery parking_spots live in `useSeekerDiscoverySpots` (local upsert/remove).
 * Visibility + short poll reconcile when Realtime is missed during an active claim.
 */
export function MapRealtimeSync({
  userId,
  activeClaimId = null,
}: MapRealtimeSyncProps) {
  const scheduleRefresh = useDebouncedRouterRefresh();

  useActiveHandoffReconciliation(Boolean(userId && activeClaimId));

  useRealtimeInvalidation({
    channelName: activeClaimId
      ? `map-claim:${activeClaimId}`
      : `map-claim-idle:${userId}`,
    enabled: Boolean(userId && activeClaimId),
    changes: activeClaimId
      ? [
          {
            event: "*",
            table: "claims",
            filter: `id=eq.${activeClaimId}`,
          },
        ]
      : [],
    onEvent: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      const next = rowStatus(payload.new as Record<string, unknown>);
      const claimId =
        rowId(payload.new as Record<string, unknown>) ??
        rowId(payload.old as Record<string, unknown>) ??
        activeClaimId;

      if (claimId && next === "cancelled") {
        const key = realtimeFeedbackKey("claim", claimId, "cancelled");
        if (!isRealtimeFeedbackSuppressed(key)) {
          suppressRealtimeFeedback(key);
          notifySeekerHandoffTerminal({
            claimId,
            reason: "publisher_cancel",
          });
        }
      } else if (claimId && next === "expired") {
        const key = realtimeFeedbackKey("claim", claimId, "expired");
        if (!isRealtimeFeedbackSuppressed(key)) {
          suppressRealtimeFeedback(key);
          notifySeekerHandoffTerminal({ claimId, reason: "expired" });
        }
      } else if (claimId && next === "completed") {
        const key = realtimeFeedbackKey("claim", claimId, "completed");
        if (!isRealtimeFeedbackSuppressed(key)) {
          suppressRealtimeFeedback(key);
          notifySeekerHandoffTerminal({ claimId, reason: "completed" });
          presentHandoffCompletionSuccess({ claimId, role: "seeker" });
          sensoryHandoffCompleted(claimId);
        }
      }

      scheduleRefresh();
    },
  });

  return null;
}
