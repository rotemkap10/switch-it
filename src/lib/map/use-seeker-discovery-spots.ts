"use client";

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";

import { subscribeDiscoverySpotTombstone } from "@/lib/map/discovery-spot-tombstone-bus";
import {
  applyParkingSpotRealtimeEvent,
  logSpotsRealtime,
  mergeServerDiscoverySpots,
  tombstoneDiscoverySpot,
  type DiscoveryTombstones,
} from "@/lib/map/seeker-discovery-spots";
import { useDebouncedRouterRefresh } from "@/lib/realtime/use-debounced-router-refresh";
import { useRealtimeInvalidation } from "@/lib/realtime/use-realtime-invalidation";
import type { MapSpot } from "@/types/map-spot";

/** Fallback poll while browsing — Realtime is primary. */
export const DISCOVERY_RECONCILE_POLL_MS = 12_000;

type UseSeekerDiscoverySpotsOptions = {
  serverSpots: MapSpot[];
  userId: string;
  enabled?: boolean;
};

/**
 * Local discovery list: realtime upsert/remove + tombstones against stale RSC
 * fetches + visibility/reconnect/poll reconciliation.
 */
export function useSeekerDiscoverySpots({
  serverSpots,
  userId,
  enabled = true,
}: UseSeekerDiscoverySpotsOptions): MapSpot[] {
  const [spots, setSpots] = useState<MapSpot[]>(serverSpots);
  const tombstonesRef = useRef<DiscoveryTombstones>(new Map());
  const spotsRef = useRef(spots);
  const hadSubscribedRef = useRef(false);
  const scheduleRefresh = useDebouncedRouterRefresh();

  useEffect(() => {
    spotsRef.current = spots;
  }, [spots]);

  // Server props win as truth, but tombstones block stale resurrection.
  useEffect(() => {
    const merged = mergeServerDiscoverySpots(
      serverSpots,
      tombstonesRef.current,
    );
    tombstonesRef.current = merged.tombstones;
    setSpots((prev) => {
      if (
        prev.length === merged.spots.length &&
        prev.every((spot, index) => spot.id === merged.spots[index]?.id) &&
        prev.every((spot, index) => {
          const next = merged.spots[index];
          return (
            next != null &&
            spot.latitude === next.latitude &&
            spot.longitude === next.longitude &&
            spot.address === next.address &&
            spot.available_at === next.available_at &&
            spot.expires_at === next.expires_at &&
            spot.canClaim === next.canClaim
          );
        })
      ) {
        return prev;
      }
      return merged.spots;
    });
  }, [serverSpots]);

  const applyPayload = useCallback(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      const result = applyParkingSpotRealtimeEvent(
        spotsRef.current,
        tombstonesRef.current,
        payload,
        userId,
      );
      tombstonesRef.current = result.tombstones;

      logSpotsRealtime(`${payload.eventType}`, {
        spotId: result.spotId,
        status: result.status,
        action: result.action,
      });

      if (result.action === "remove" && result.spotId) {
        logSpotsRealtime("remove", { spotId: result.spotId });
      }

      if (result.changed) {
        setSpots(result.spots);
      }
      scheduleRefresh();
    },
    [scheduleRefresh, userId],
  );

  useRealtimeInvalidation({
    channelName: `map-spots:${userId}`,
    enabled: Boolean(enabled && userId),
    changes: [
      {
        event: "*",
        table: "parking_spots",
      },
    ],
    onEvent: applyPayload,
    onSubscriptionStatus: (status) => {
      if (status !== "SUBSCRIBED") {
        return;
      }
      if (!hadSubscribedRef.current) {
        hadSubscribedRef.current = true;
        logSpotsRealtime("subscribed");
        return;
      }
      logSpotsRealtime("reconnect reconciliation");
      scheduleRefresh();
    },
  });

  // Visibility + low-frequency poll while browsing Find Parking.
  useEffect(() => {
    if (!enabled || !userId) {
      return;
    }

    function reconcile(reason: string) {
      if (reason !== "poll reconciliation") {
        logSpotsRealtime(reason);
      }
      scheduleRefresh();
    }

    function onVisibility() {
      if (document.visibilityState === "visible") {
        reconcile("visibility restore");
      }
    }

    function onOnline() {
      reconcile("network online");
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        reconcile("poll reconciliation");
      }
    }, DISCOVERY_RECONCILE_POLL_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.clearInterval(intervalId);
    };
  }, [enabled, scheduleRefresh, userId]);

  // Failed claim on a spot that just became unavailable.
  useEffect(() => {
    return subscribeDiscoverySpotTombstone((spotId) => {
      const result = tombstoneDiscoverySpot(
        spotsRef.current,
        tombstonesRef.current,
        spotId,
      );
      tombstonesRef.current = result.tombstones;
      if (result.changed) {
        logSpotsRealtime("remove", { spotId, reason: "stale-claim" });
        setSpots(result.spots);
      }
      scheduleRefresh();
    });
  }, [scheduleRefresh]);

  return spots;
}
