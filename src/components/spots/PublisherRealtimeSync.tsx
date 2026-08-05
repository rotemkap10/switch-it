"use client";

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

import { useFeedback } from "@/components/feedback/FeedbackProvider";
import {
  isRealtimeFeedbackSuppressed,
  realtimeFeedbackKey,
} from "@/lib/realtime/feedback-suppression";
import { useDebouncedRouterRefresh } from "@/lib/realtime/use-debounced-router-refresh";
import { useRealtimeInvalidation } from "@/lib/realtime/use-realtime-invalidation";

type PublisherRealtimeSyncProps = {
  userId: string;
  /** Open spot id when the publisher has one. */
  spotId?: string | null;
  /** Active claim id when the spot is claimed. */
  claimId?: string | null;
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
 * Publisher /spots/new Realtime invalidation.
 * Spot + related claim events trigger authorized RSC refetch (code/vehicle via RPCs).
 */
export function PublisherRealtimeSync({
  userId,
  spotId = null,
  claimId = null,
}: PublisherRealtimeSyncProps) {
  const scheduleRefresh = useDebouncedRouterRefresh();
  const { info } = useFeedback();

  useRealtimeInvalidation({
    channelName: `publisher-spot:${userId}`,
    enabled: Boolean(userId),
    changes: [
      {
        event: "*",
        table: "parking_spots",
        filter: `owner_id=eq.${userId}`,
      },
    ],
    onEvent: () => {
      // Status UI handles available → claimed; no toast.
      scheduleRefresh();
    },
  });

  useRealtimeInvalidation({
    channelName: claimId
      ? `publisher-claim:${claimId}`
      : `publisher-claim-idle:${userId}`,
    enabled: Boolean(userId && claimId),
    changes: claimId
      ? [
          {
            event: "*",
            table: "claims",
            filter: `id=eq.${claimId}`,
          },
        ]
      : [],
    onEvent: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      const next = rowStatus(payload.new as Record<string, unknown>);
      const id =
        rowId(payload.new as Record<string, unknown>) ??
        rowId(payload.old as Record<string, unknown>) ??
        claimId;

      if (id && next === "cancelled") {
        const claimKey = realtimeFeedbackKey("claim", id, "cancelled");
        const spotKey = spotId
          ? realtimeFeedbackKey("spot", spotId, "cancelled")
          : null;
        if (
          !isRealtimeFeedbackSuppressed(claimKey) &&
          !(spotKey && isRealtimeFeedbackSuppressed(spotKey))
        ) {
          info("The driver is no longer coming.");
        }
      } else if (id && next === "expired") {
        const key = realtimeFeedbackKey("claim", id, "expired");
        if (!isRealtimeFeedbackSuppressed(key)) {
          info("This parking handoff expired.");
        }
      }

      scheduleRefresh();
    },
  });

  // When spot exists but claim id not yet known, still watch claims on that spot
  // so available → claimed is caught via claim INSERT (owner can SELECT).
  useRealtimeInvalidation({
    channelName: spotId
      ? `publisher-spot-claims:${spotId}`
      : `publisher-spot-claims-idle:${userId}`,
    enabled: Boolean(userId && spotId && !claimId),
    changes: spotId
      ? [
          {
            event: "*",
            table: "claims",
            filter: `spot_id=eq.${spotId}`,
          },
        ]
      : [],
    onEvent: () => {
      scheduleRefresh();
    },
  });

  return null;
}
