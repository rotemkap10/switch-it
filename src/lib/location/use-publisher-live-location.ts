"use client";

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  SEEKER_LOCATION_EVENT,
  SEEKER_LOCATION_STATUS_EVENT,
} from "@/lib/location/constants";
import { fetchLatestClaimLiveLocation } from "@/lib/location/fetch-claim-live-location";
import { isNewerSeekerLocation } from "@/lib/location/location-ordering";
import { logHandoffLive } from "@/lib/location/log-handoff-live";
import {
  parseSeekerLocationPayload,
  parseSeekerLocationStatusPayload,
  type SeekerLocationPayload,
} from "@/lib/location/payload";
import {
  LIVE_LOCATION_PAUSE_WHILE_NAVIGATING,
  liveLocationFreshness,
  liveLocationStatusLabel,
  liveLocationUpdatedLabel,
  type LiveLocationFreshness,
} from "@/lib/location/stale";
import { getClaimLocationTopic } from "@/lib/location/topic";
import { createClient } from "@/lib/supabase/client";

export type PublisherLiveLocationState = {
  freshness: LiveLocationFreshness;
  statusLabel: string;
  updatedLabel: string;
  pauseHint: string | null;
  location: SeekerLocationPayload | null;
  lastReceivedAtMs: number | null;
};

type UsePublisherLiveLocationOptions = {
  claimId: string | null;
  enabled: boolean;
};

type LiveSnapshot = {
  location: SeekerLocationPayload | null;
  lastReceivedAtMs: number | null;
  explicitPaused: boolean;
  connectionFailed: boolean;
  generation: number;
};

const EMPTY_SNAPSHOT: LiveSnapshot = {
  location: null,
  lastReceivedAtMs: null,
  explicitPaused: false,
  connectionFailed: false,
  generation: 0,
};

type CachedLiveLocation = {
  location: SeekerLocationPayload;
  lastReceivedAtMs: number;
};

/** Survives Share-a-Spot unmount when navigating to Profile and back. */
const liveLocationByClaimId = new Map<string, CachedLiveLocation>();

function readCachedLiveLocation(claimId: string | null): CachedLiveLocation | null {
  if (!claimId) {
    return null;
  }
  return liveLocationByClaimId.get(claimId) ?? null;
}

function writeCachedLiveLocation(
  claimId: string,
  location: SeekerLocationPayload,
  lastReceivedAtMs: number,
) {
  liveLocationByClaimId.set(claimId, { location, lastReceivedAtMs });
}

function clearCachedLiveLocation(claimId: string | null) {
  if (!claimId) {
    liveLocationByClaimId.clear();
    return;
  }
  liveLocationByClaimId.delete(claimId);
}

function snapshotFromCache(claimId: string | null): LiveSnapshot {
  const cached = readCachedLiveLocation(claimId);
  if (!cached) {
    return EMPTY_SNAPSHOT;
  }
  return {
    location: cached.location,
    lastReceivedAtMs: cached.lastReceivedAtMs,
    explicitPaused: false,
    connectionFailed: false,
    generation: 0,
  };
}

/** Test-only: drop in-memory last-known locations between cases. */
export function resetPublisherLiveLocationCacheForTests() {
  liveLocationByClaimId.clear();
}

function publisherStatusLabel(
  freshness: LiveLocationFreshness,
  hasLocation: boolean,
): string {
  if (!hasLocation) {
    return liveLocationStatusLabel("waiting");
  }
  if (freshness === "live") {
    return liveLocationStatusLabel("live");
  }
  return liveLocationStatusLabel("delayed");
}

/**
 * Publisher subscription to private seeker-location Broadcast for one claim.
 * Broadcast is primary; latest DB snapshot (`claim_live_locations`) recovers
 * missed first updates, refresh, and reconnect without location history.
 */
export function usePublisherLiveLocation({
  claimId,
  enabled,
}: UsePublisherLiveLocationOptions): PublisherLiveLocationState & {
  clear: () => void;
} {
  const active = enabled && !!claimId;
  const [snapshot, setSnapshot] = useState<LiveSnapshot>(() =>
    snapshotFromCache(claimId),
  );
  const [nowMs, setNowMs] = useState(() => Date.now());

  const channelRef = useRef<RealtimeChannel | null>(null);
  const clientRef = useRef<SupabaseClient | null>(null);
  const lastSequenceRef = useRef(0);
  const terminalRef = useRef(false);
  const generationRef = useRef(0);
  const hadSubscribedRef = useRef(false);
  const lastKnownRef = useRef<SeekerLocationPayload | null>(null);
  const lastReceivedAtRef = useRef<number | null>(null);
  const lastKnownClaimIdRef = useRef<string | null>(null);

  const clear = useCallback(() => {
    terminalRef.current = true;
    lastSequenceRef.current = 0;
    lastKnownRef.current = null;
    lastReceivedAtRef.current = null;
    clearCachedLiveLocation(lastKnownClaimIdRef.current);
    lastKnownClaimIdRef.current = null;
    hadSubscribedRef.current = false;
    generationRef.current += 1;
    setSnapshot({
      location: null,
      lastReceivedAtMs: null,
      explicitPaused: false,
      connectionFailed: false,
      generation: generationRef.current,
    });
  }, []);

  useEffect(() => {
    if (!active || !claimId) {
      terminalRef.current = true;
      const channel = channelRef.current;
      const client = clientRef.current;
      channelRef.current = null;
      if (channel && client) {
        void client.removeChannel(channel);
      }
      return;
    }

    terminalRef.current = false;
    hadSubscribedRef.current = false;
    const generation = ++generationRef.current;
    const cached = readCachedLiveLocation(claimId);
    if (cached) {
      lastKnownRef.current = cached.location;
      lastReceivedAtRef.current = cached.lastReceivedAtMs;
      lastSequenceRef.current = cached.location.sequence;
      lastKnownClaimIdRef.current = claimId;
    } else if (lastKnownClaimIdRef.current !== claimId) {
      lastKnownRef.current = null;
      lastReceivedAtRef.current = null;
      lastSequenceRef.current = 0;
      lastKnownClaimIdRef.current = claimId;
    }

    const topic = getClaimLocationTopic(claimId);
    if (!topic) {
      logHandoffLive("publisher topic invalid", { claimId });
      return;
    }

    const activeClaimId = claimId;

    let cancelled = false;
    const client = createClient();
    clientRef.current = client;

    function applyLocation(
      parsed: SeekerLocationPayload,
      source: "broadcast" | "snapshot",
    ) {
      if (!isNewerSeekerLocation(parsed, lastKnownRef.current)) {
        if (source === "snapshot") {
          logHandoffLive("snapshot ignored stale", {
            claimId,
            topic,
            sequence: parsed.sequence,
            timestamp: parsed.sentAt,
          });
        }
        return;
      }

      lastSequenceRef.current = parsed.sequence;
      const receivedAt = Date.now();
      lastKnownRef.current = parsed;
      lastReceivedAtRef.current = receivedAt;
      writeCachedLiveLocation(activeClaimId, parsed, receivedAt);

      if (source === "broadcast") {
        logHandoffLive("publisher location received", {
          claimId,
          topic,
          source: "broadcast",
          lat: parsed.latitude,
          lng: parsed.longitude,
          accuracy: parsed.accuracyMeters,
          timestamp: parsed.sentAt,
          age: receivedAt - parsed.sentAt,
          sequence: parsed.sequence,
        });
      } else {
        logHandoffLive("snapshot accepted", {
          claimId,
          topic,
          sequence: parsed.sequence,
          timestamp: parsed.sentAt,
        });
      }

      logHandoffLive("publisher marker updated", {
        claimId,
        topic,
        source,
        lat: parsed.latitude,
        lng: parsed.longitude,
        sequence: parsed.sequence,
      });

      setSnapshot({
        location: parsed,
        lastReceivedAtMs: receivedAt,
        explicitPaused: false,
        connectionFailed: false,
        generation,
      });
    }

    async function reconcileLatestSnapshot(reason: string) {
      if (cancelled || terminalRef.current) {
        return;
      }
      logHandoffLive("latest snapshot fetch started", { claimId, topic, reason });
      const parsed = await fetchLatestClaimLiveLocation(client, activeClaimId);
      if (cancelled || terminalRef.current) {
        return;
      }
      if (!parsed) {
        logHandoffLive("latest snapshot empty", { claimId, topic, reason });
        return;
      }
      logHandoffLive("latest snapshot found", {
        claimId,
        topic,
        reason,
        timestamp: parsed.sentAt,
        sequence: parsed.sequence,
      });
      applyLocation(parsed, "snapshot");
    }

    void (async () => {
      const { data } = await client.auth.getSession();
      const token = data.session?.access_token;
      if (!token || cancelled) {
        logHandoffLive("publisher session missing", { claimId, topic });
        return;
      }
      await client.realtime.setAuth(token);
      if (cancelled) {
        return;
      }

      setSnapshot({
        location: lastKnownRef.current,
        lastReceivedAtMs: lastReceivedAtRef.current,
        explicitPaused: false,
        connectionFailed: false,
        generation,
      });

      void reconcileLatestSnapshot("mount");

      const existingChannels =
        typeof client.getChannels === "function" ? client.getChannels() : [];
      await Promise.all(
        existingChannels
          .filter((channel) => {
            const name = channel.topic ?? "";
            return name === topic || name.endsWith(`:${topic}`) || name.includes(topic);
          })
          .map((channel) => client.removeChannel(channel)),
      );
      if (cancelled) {
        return;
      }

      const channel = client.channel(topic, {
        config: {
          private: true,
          broadcast: { self: false },
        },
      });
      channelRef.current = channel;

      channel.on("broadcast", { event: SEEKER_LOCATION_EVENT }, ({ payload }) => {
        if (cancelled || terminalRef.current) {
          return;
        }
        const parsed = parseSeekerLocationPayload(payload);
        if (!parsed) {
          logHandoffLive("publisher payload rejected", {
            claimId,
            topic,
            reason: "invalid_payload",
          });
          return;
        }
        applyLocation(parsed, "broadcast");
      });

      channel.on(
        "broadcast",
        { event: SEEKER_LOCATION_STATUS_EVENT },
        ({ payload }) => {
          if (cancelled || terminalRef.current) {
            return;
          }
          const parsed = parseSeekerLocationStatusPayload(payload);
          if (!parsed) {
            return;
          }
          if (parsed.sequence <= lastSequenceRef.current) {
            return;
          }
          lastSequenceRef.current = parsed.sequence;
          if (parsed.status === "paused" || parsed.status === "stopped") {
            setSnapshot((prev) =>
              prev.generation === generation
                ? { ...prev, explicitPaused: true }
                : prev,
            );
          }
        },
      );

      logHandoffLive("publisher channel subscribing", {
        claimId,
        topic,
        role: "publisher",
      });

      channel.subscribe((status) => {
        if (cancelled || terminalRef.current) {
          return;
        }
        if (status === "SUBSCRIBED") {
          logHandoffLive("publisher channel subscribed", {
            claimId,
            topic,
            role: "publisher",
          });
          setSnapshot((prev) =>
            prev.generation === generation
              ? { ...prev, connectionFailed: false }
              : prev,
          );
          const reason = hadSubscribedRef.current ? "reconnect" : "initial";
          hadSubscribedRef.current = true;
          void reconcileLatestSnapshot(reason);
          return;
        }
        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          logHandoffLive(`CHANNEL ${status}`, {
            claimId,
            topic,
            role: "publisher",
          });
          setSnapshot((prev) =>
            prev.generation === generation
              ? { ...prev, connectionFailed: true }
              : prev,
          );
        }
      });
    })();

    function onVisibilityRestore() {
      if (document.visibilityState === "visible") {
        void reconcileLatestSnapshot("visibility restore");
      }
    }

    function onOnline() {
      void reconcileLatestSnapshot("network online");
    }

    function onPageShow() {
      void reconcileLatestSnapshot("pageshow");
    }

    function onWindowFocus() {
      void reconcileLatestSnapshot("window focus");
    }

    document.addEventListener("visibilitychange", onVisibilityRestore);
    window.addEventListener("online", onOnline);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("focus", onWindowFocus);

    return () => {
      cancelled = true;
      terminalRef.current = true;
      document.removeEventListener("visibilitychange", onVisibilityRestore);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("focus", onWindowFocus);
      const channel = channelRef.current;
      channelRef.current = null;
      if (channel) {
        void client.removeChannel(channel);
      }
    };
  }, [active, claimId]);

  useEffect(() => {
    if (!active) {
      return;
    }
    const id = window.setInterval(() => {
      if (document.visibilityState === "hidden") {
        return;
      }
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, [active]);

  if (!active) {
    return {
      freshness: "waiting",
      statusLabel: liveLocationStatusLabel("waiting"),
      updatedLabel: liveLocationUpdatedLabel("waiting", null),
      pauseHint: null,
      location: null,
      lastReceivedAtMs: null,
      clear,
    };
  }

  const ageFreshness = liveLocationFreshness(snapshot.lastReceivedAtMs, nowMs);
  let freshness: Exclude<LiveLocationFreshness, "unavailable"> = ageFreshness;
  if (snapshot.explicitPaused && ageFreshness !== "waiting") {
    freshness = "delayed";
  }
  if (snapshot.connectionFailed && snapshot.location) {
    freshness = ageFreshness === "live" ? "delayed" : ageFreshness;
    if (freshness === "waiting") {
      freshness = "delayed";
    }
  } else if (snapshot.connectionFailed && !snapshot.location) {
    freshness = "waiting";
  }

  return {
    freshness,
    statusLabel: publisherStatusLabel(freshness, snapshot.location != null),
    updatedLabel: liveLocationUpdatedLabel(
      freshness === "waiting" && snapshot.location
        ? "delayed"
        : freshness,
      snapshot.lastReceivedAtMs,
      nowMs,
    ),
    pauseHint:
      snapshot.explicitPaused && !snapshot.connectionFailed && snapshot.location
        ? LIVE_LOCATION_PAUSE_WHILE_NAVIGATING
        : null,
    location: snapshot.location,
    lastReceivedAtMs: snapshot.lastReceivedAtMs,
    clear,
  };
}
