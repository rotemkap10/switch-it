"use client";

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef } from "react";

import {
  isRealtimeFeedbackSuppressed,
  realtimeFeedbackKey,
  suppressRealtimeFeedback,
} from "@/lib/realtime/feedback-suppression";
import { logClaimRealtime } from "@/lib/realtime/log-claim-realtime";
import {
  publisherClaimHintFromPayload,
  type PublisherClaimHint,
} from "@/lib/realtime/publisher-spot-sync";
import { useActiveHandoffReconciliation } from "@/lib/realtime/use-active-handoff-reconciliation";
import { useDebouncedRouterRefresh } from "@/lib/realtime/use-debounced-router-refresh";
import { useRealtimeInvalidation } from "@/lib/realtime/use-realtime-invalidation";
import { presentHandoffCompletionSuccess } from "@/lib/handoff/handoff-completion-success";
import { presentHandoffTerminalEnded } from "@/lib/handoff/handoff-terminal-ended";
import { sensoryHandoffCompleted } from "@/lib/sensory/feedback";

type PublisherRealtimeSyncProps = {
  userId: string;
  /** Open spot id when the publisher has one. */
  spotId?: string | null;
  /** Active claim id when the spot is claimed. */
  claimId?: string | null;
  /** Optimistic local transition when Realtime detects a new claim. */
  onClaimHint?: (hint: PublisherClaimHint) => void;
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

function logParkingSpotEvent(
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
  spotId: string | null,
): void {
  const next = payload.new as Record<string, unknown> | null;
  const id = rowId(next) ?? rowId(payload.old as Record<string, unknown>);
  logClaimRealtime("parking spot UPDATE received", {
    spotId: id ?? spotId,
    status: rowStatus(next),
    eventType: payload.eventType,
  });
}

function logClaimEvent(
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
  spotId: string | null,
): void {
  const next = payload.new as Record<string, unknown> | null;
  logClaimRealtime("claim INSERT/UPDATE received", {
    claimId:
      rowId(next) ?? rowId(payload.old as Record<string, unknown>) ?? null,
    spotId:
      (typeof next?.spot_id === "string" ? next.spot_id : null) ?? spotId,
    status: rowStatus(next),
    eventType: payload.eventType,
  });
}

/**
 * Publisher /spots/new Realtime invalidation.
 * Spot + related claim events trigger authorized RSC refetch (code/vehicle via RPCs).
 * Visibility + short poll reconcile while an open spot exists (waiting or claimed).
 */
export function PublisherRealtimeSync({
  userId,
  spotId = null,
  claimId = null,
  onClaimHint,
}: PublisherRealtimeSyncProps) {
  const scheduleRefresh = useDebouncedRouterRefresh();
  const onClaimHintRef = useRef(onClaimHint);
  const hadSpotSubscribedRef = useRef(false);
  const hadClaimsSubscribedRef = useRef(false);

  useEffect(() => {
    onClaimHintRef.current = onClaimHint;
  }, [onClaimHint]);

  useEffect(() => {
    if (spotId) {
      logClaimRealtime("publisher spot waiting", { spotId, claimId: claimId ?? "none" });
    }
  }, [spotId, claimId]);

  // Reconcile while publisher has any open spot — waiting or active handoff.
  useActiveHandoffReconciliation(Boolean(userId && spotId));

  const applyClaimHint = useCallback(
    (
      payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
      expectedSpotId: string,
    ) => {
      const hint = publisherClaimHintFromPayload(payload, expectedSpotId);
      if (!hint) {
        return;
      }
      logClaimRealtime("active claim resolved", {
        claimId: hint.claimId ?? "pending-rsc",
        spotId: hint.spotId,
        source: hint.source,
      });
      logClaimRealtime("publisher transition to active handoff", {
        spotId: hint.spotId,
        claimId: hint.claimId ?? "pending-rsc",
      });
      onClaimHintRef.current?.(hint);
    },
    [],
  );

  const handleSpotReconnect = useCallback(
    (status: "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR") => {
      if (status !== "SUBSCRIBED") {
        return;
      }
      logClaimRealtime("channel subscribed", {
        channel: `publisher-spot:${userId}`,
      });
      if (!hadSpotSubscribedRef.current) {
        hadSpotSubscribedRef.current = true;
        return;
      }
      logClaimRealtime("reconnect reconciliation", {
        channel: `publisher-spot:${userId}`,
      });
      scheduleRefresh();
    },
    [scheduleRefresh, userId],
  );

  const handleSpotClaimsReconnect = useCallback(
    (status: "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR") => {
      if (status !== "SUBSCRIBED" || !spotId) {
        return;
      }
      logClaimRealtime("channel subscribed", {
        channel: `publisher-spot-claims:${spotId}`,
      });
      if (!hadClaimsSubscribedRef.current) {
        hadClaimsSubscribedRef.current = true;
        return;
      }
      logClaimRealtime("reconnect reconciliation", {
        channel: `publisher-spot-claims:${spotId}`,
      });
      scheduleRefresh();
    },
    [scheduleRefresh, spotId],
  );

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
    onEvent: (payload) => {
      logParkingSpotEvent(payload, spotId);
      const next = rowStatus(payload.new as Record<string, unknown>);
      const id =
        rowId(payload.new as Record<string, unknown>) ??
        rowId(payload.old as Record<string, unknown>) ??
        spotId;
      if (spotId && id === spotId && next === "expired" && !claimId) {
        const key = realtimeFeedbackKey("spot", spotId, "expired");
        if (!isRealtimeFeedbackSuppressed(key)) {
          suppressRealtimeFeedback(key);
          presentHandoffTerminalEnded({
            id: spotId,
            role: "publisher",
            kind: "expired",
          });
        }
      }
      if (spotId) {
        applyClaimHint(payload, spotId);
      }
      scheduleRefresh();
    },
    onSubscriptionStatus: (status) => {
      if (status === "SUBSCRIBED") {
        logClaimRealtime("channel subscribing", {
          channel: `publisher-spot:${userId}`,
        });
      }
      handleSpotReconnect(status);
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

      if (spotId) {
        applyClaimHint(
          { ...payload, table: payload.table || "claims" },
          spotId,
        );
      }

      if (id && next === "cancelled") {
        const claimKey = realtimeFeedbackKey("claim", id, "cancelled");
        const spotKey = spotId
          ? realtimeFeedbackKey("spot", spotId, "cancelled")
          : null;
        if (
          !isRealtimeFeedbackSuppressed(claimKey) &&
          !(spotKey && isRealtimeFeedbackSuppressed(spotKey))
        ) {
          presentHandoffTerminalEnded({
            id,
            role: "publisher",
            kind: "seeker_released",
          });
          suppressRealtimeFeedback(claimKey);
          if (spotKey) {
            suppressRealtimeFeedback(spotKey);
          }
        }
      } else if (id && next === "expired") {
        const key = realtimeFeedbackKey("claim", id, "expired");
        if (!isRealtimeFeedbackSuppressed(key)) {
          presentHandoffTerminalEnded({
            id,
            role: "publisher",
            kind: "expired",
          });
          suppressRealtimeFeedback(key);
        }
      } else if (id && next === "completed") {
        const key = realtimeFeedbackKey("claim", id, "completed");
        if (!isRealtimeFeedbackSuppressed(key)) {
          presentHandoffCompletionSuccess({ claimId: id, role: "publisher" });
          sensoryHandoffCompleted(id);
          suppressRealtimeFeedback(key);
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
    onEvent: (payload) => {
      logClaimEvent(payload, spotId);
      if (spotId) {
        applyClaimHint(payload, spotId);
      }
      scheduleRefresh();
    },
    onSubscriptionStatus: (status) => {
      if (status === "SUBSCRIBED" && spotId) {
        logClaimRealtime("channel subscribing", {
          channel: `publisher-spot-claims:${spotId}`,
        });
      }
      handleSpotClaimsReconnect(status);
    },
  });

  return null;
}
