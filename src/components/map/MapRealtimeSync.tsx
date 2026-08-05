"use client";

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

import { useFeedback } from "@/components/feedback/FeedbackProvider";
import {
  isRealtimeFeedbackSuppressed,
  realtimeFeedbackKey,
} from "@/lib/realtime/feedback-suppression";
import { useDebouncedRouterRefresh } from "@/lib/realtime/use-debounced-router-refresh";
import { useRealtimeInvalidation } from "@/lib/realtime/use-realtime-invalidation";

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
 * Seeker /map Realtime invalidation.
 * - parking_spots: refresh discovery markers
 * - claims (own active): refresh claim sheet + terminal feedback
 */
export function MapRealtimeSync({
  userId,
  activeClaimId = null,
}: MapRealtimeSyncProps) {
  const scheduleRefresh = useDebouncedRouterRefresh();
  const { info } = useFeedback();

  useRealtimeInvalidation({
    channelName: `map-spots:${userId}`,
    enabled: Boolean(userId),
    changes: [
      {
        event: "*",
        table: "parking_spots",
      },
    ],
    onEvent: () => {
      // Invalidation only — RSC rebuilds filtered available spots.
      scheduleRefresh();
    },
  });

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
          info("The parking handoff was cancelled.");
        }
      } else if (claimId && next === "expired") {
        const key = realtimeFeedbackKey("claim", claimId, "expired");
        if (!isRealtimeFeedbackSuppressed(key)) {
          info("This parking handoff expired.");
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
