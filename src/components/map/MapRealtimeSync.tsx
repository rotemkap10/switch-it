"use client";

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

import { useFeedback } from "@/components/feedback/FeedbackProvider";
import {
  isRealtimeFeedbackSuppressed,
  realtimeFeedbackKey,
  suppressRealtimeFeedback,
} from "@/lib/realtime/feedback-suppression";
import { useActiveHandoffReconciliation } from "@/lib/realtime/use-active-handoff-reconciliation";
import { useDebouncedRouterRefresh } from "@/lib/realtime/use-debounced-router-refresh";
import { useRealtimeInvalidation } from "@/lib/realtime/use-realtime-invalidation";

export const SEEKER_CLAIM_CANCELLED_BY_PUBLISHER =
  "The driver cancelled this handoff.";

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
  const { info } = useFeedback();

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
          info(SEEKER_CLAIM_CANCELLED_BY_PUBLISHER);
          suppressRealtimeFeedback(key);
        }
      } else if (claimId && next === "expired") {
        const key = realtimeFeedbackKey("claim", claimId, "expired");
        if (!isRealtimeFeedbackSuppressed(key)) {
          info(
            "Handoff expired\nThe handoff window ended. No credits were changed.",
          );
          suppressRealtimeFeedback(key);
        }
      } else if (claimId && next === "completed") {
        // Local completeClaim already toasts; suppress duplicate.
        const key = realtimeFeedbackKey("claim", claimId, "completed");
        if (!isRealtimeFeedbackSuppressed(key)) {
          // Remote completion is rare; keep quiet — status UI updates via refresh.
        }
      }

      scheduleRefresh();
    },
  });

  return null;
}
