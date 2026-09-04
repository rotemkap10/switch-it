"use client";

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  SEEKER_LOCATION_EVENT,
  SEEKER_LOCATION_STATUS_EVENT,
} from "@/lib/location/constants";
import { fetchLatestClaimLiveLocation } from "@/lib/location/fetch-claim-live-location";
import { isNewerSeekerLocation } from "@/lib/location/location-ordering";
import { logHandoffLiveReceiver } from "@/lib/location/log-handoff-live-receiver";
import { isNativeHandoffPlatform } from "@/lib/location/is-native-handoff-platform";
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

type ReceiverPhase =
  | "idle"
  | "authorizing"
  | "subscribing"
  | "subscribed"
  | "reconnecting"
  | "disposed";

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
 * Broadcast is primary; latest DB snapshot recovers missed pre-SUBSCRIBED events.
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
  const channelGenerationRef = useRef(0);
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
    channelGenerationRef.current += 1;
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
      channelGenerationRef.current += 1;
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
    channelGenerationRef.current += 1;

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
      logHandoffLiveReceiver("topic invalid", { claimId });
      return;
    }

    const validatedTopic = topic;
    logHandoffLiveReceiver("publisher claim active", {
      claimId,
      topic: validatedTopic,
      generation,
      nativeCapacitor: isNativeHandoffPlatform(),
    });

    const activeClaimId = claimId;

    let cancelled = false;
    let reconnectTimer: number | null = null;
    let waitingSnapshotTimer: number | null = null;
    let phase: ReceiverPhase = "idle";
    let subscribeInFlight = false;
    let disposingChannel = false;
    let channelGeneration = channelGenerationRef.current;

    const client = createClient();
    clientRef.current = client;

    function isStale(callbackGeneration: number, callbackChannelGen: number) {
      return (
        cancelled ||
        terminalRef.current ||
        generation !== generationRef.current ||
        callbackChannelGen !== channelGenerationRef.current ||
        callbackGeneration !== generation
      );
    }

    function applyLocation(
      parsed: SeekerLocationPayload,
      source: "broadcast" | "snapshot",
    ) {
      if (!isNewerSeekerLocation(parsed, lastKnownRef.current)) {
        if (source === "snapshot") {
          logHandoffLiveReceiver("snapshot ignored stale", {
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
        logHandoffLiveReceiver("event received", {
          claimId,
          topic,
          sequence: parsed.sequence,
        });
        logHandoffLiveReceiver("payload accepted", {
          claimId,
          topic,
          accuracy: parsed.accuracyMeters,
          ageMs: receivedAt - parsed.sentAt,
          sequence: parsed.sequence,
        });
      } else {
        logHandoffLiveReceiver("snapshot accepted", {
          claimId,
          topic,
          sequence: parsed.sequence,
          timestamp: parsed.sentAt,
        });
      }

      logHandoffLiveReceiver("marker state updated", {
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
      clearWaitingSnapshotPoll();
    }

    function scheduleWaitingSnapshotPoll() {
      if (
        waitingSnapshotTimer !== null ||
        cancelled ||
        terminalRef.current ||
        generation !== generationRef.current ||
        lastKnownRef.current
      ) {
        return;
      }
      waitingSnapshotTimer = window.setTimeout(() => {
        waitingSnapshotTimer = null;
        if (
          cancelled ||
          terminalRef.current ||
          generation !== generationRef.current ||
          lastKnownRef.current ||
          phase !== "subscribed"
        ) {
          return;
        }
        void reconcileLatestSnapshot("waiting poll").finally(() => {
          scheduleWaitingSnapshotPoll();
        });
      }, 3_000);
    }

    function clearWaitingSnapshotPoll() {
      if (waitingSnapshotTimer !== null) {
        window.clearTimeout(waitingSnapshotTimer);
        waitingSnapshotTimer = null;
      }
    }

    async function reconcileLatestSnapshot(reason: string) {
      if (cancelled || terminalRef.current || generation !== generationRef.current) {
        return;
      }
      if (phase !== "subscribed") {
        logHandoffLiveReceiver("snapshot fetch deferred", {
          claimId,
          reason,
          phase,
        });
        return;
      }
      logHandoffLiveReceiver("snapshot fetch started", {
        claimId,
        topic,
        reason,
        generation,
      });
      const parsed = await fetchLatestClaimLiveLocation(client, activeClaimId);
      if (cancelled || terminalRef.current || generation !== generationRef.current) {
        return;
      }
      if (!parsed) {
        logHandoffLiveReceiver("snapshot empty", { claimId, topic, reason, generation });
        return;
      }
      logHandoffLiveReceiver("snapshot found", {
        claimId,
        topic,
        reason,
        timestamp: parsed.sentAt,
        sequence: parsed.sequence,
        generation,
      });
      applyLocation(parsed, "snapshot");
      clearWaitingSnapshotPoll();
    }

    function scheduleReconnect(reason: string) {
      if (
        reconnectTimer !== null ||
        cancelled ||
        terminalRef.current ||
        generation !== generationRef.current
      ) {
        return;
      }
      phase = "reconnecting";
      logHandoffLiveReceiver("channel reconnect scheduled", {
        claimId,
        topic,
        reason,
        generation,
      });
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        if (!cancelled && !terminalRef.current && generation === generationRef.current) {
          void establishSubscription(`reconnect:${reason}`);
        }
      }, 1_500);
    }

    async function teardownChannel() {
      const existing = channelRef.current;
      if (!existing) {
        return;
      }
      disposingChannel = true;
      channelRef.current = null;
      channelGenerationRef.current += 1;
      channelGeneration = channelGenerationRef.current;
      try {
        await client.removeChannel(existing);
      } finally {
        disposingChannel = false;
      }
    }

    async function establishSubscription(reason: string) {
      if (cancelled || terminalRef.current || generation !== generationRef.current) {
        return;
      }

      if (subscribeInFlight) {
        logHandoffLiveReceiver("subscribe skipped in-flight", {
          claimId,
          reason,
          phase,
          generation,
        });
        return;
      }

      if (phase === "subscribed" && channelRef.current) {
        if (
          reason.includes("visibility") ||
          reason.includes("focus") ||
          reason.includes("pageshow") ||
          reason.includes("network online")
        ) {
          void reconcileLatestSnapshot(reason);
        }
        return;
      }

      if (phase === "subscribing") {
        logHandoffLiveReceiver("subscribe skipped subscribing", {
          claimId,
          reason,
          generation,
        });
        return;
      }

      subscribeInFlight = true;
      phase = "authorizing";

      let token: string | undefined;
      try {
        const { data } = await client.auth.getSession();
        token = data.session?.access_token;
      } catch {
        subscribeInFlight = false;
        phase = "idle";
        logHandoffLiveReceiver("session read failed", {
          claimId,
          topic,
          reason,
          generation,
        });
        return;
      }
      if (!token) {
        subscribeInFlight = false;
        phase = "idle";
        logHandoffLiveReceiver("session missing", { claimId, topic, reason, generation });
        return;
      }

      if (cancelled || terminalRef.current || generation !== generationRef.current) {
        subscribeInFlight = false;
        phase = "idle";
        return;
      }

      await client.realtime.setAuth(token);
      if (cancelled || terminalRef.current || generation !== generationRef.current) {
        subscribeInFlight = false;
        phase = "idle";
        return;
      }

      try {
        const { data: canReceive, error: receiveAuthError } = await client.rpc(
          "can_receive_claim_location",
          { p_topic: validatedTopic },
        );
        logHandoffLiveReceiver("receive authorized", {
          claimId,
          topic: validatedTopic,
          allowed: canReceive === true,
          rpcError: receiveAuthError?.message ?? null,
          generation,
          reason,
        });
      } catch (error) {
        logHandoffLiveReceiver("receive authorized", {
          claimId,
          topic: validatedTopic,
          allowed: null,
          rpcError: error instanceof Error ? error.message : String(error),
          generation,
          reason,
        });
      }

      setSnapshot((prev) =>
        prev.generation === generation
          ? {
              location: lastKnownRef.current,
              lastReceivedAtMs: lastReceivedAtRef.current,
              explicitPaused: prev.explicitPaused,
              connectionFailed: false,
              generation,
            }
          : prev,
      );

      if (channelRef.current) {
        await teardownChannel();
        if (cancelled || terminalRef.current || generation !== generationRef.current) {
          subscribeInFlight = false;
          phase = "idle";
          return;
        }
      }

      const existingChannels =
        typeof client.getChannels === "function" ? client.getChannels() : [];
      await Promise.all(
        existingChannels
          .filter((existingChannel) => {
            const name = existingChannel.topic ?? "";
            return (
              name === validatedTopic ||
              name.endsWith(`:${validatedTopic}`) ||
              name.includes(validatedTopic)
            );
          })
          .map((existingChannel) => client.removeChannel(existingChannel)),
      );
      if (cancelled || terminalRef.current || generation !== generationRef.current) {
        subscribeInFlight = false;
        phase = "idle";
        return;
      }

      phase = "subscribing";
      channelGeneration = ++channelGenerationRef.current;
      const callbackChannelGen = channelGeneration;

      const channel = client.channel(validatedTopic, {
        config: {
          private: true,
          broadcast: { self: false },
        },
      });
      channelRef.current = channel;

      channel.on("broadcast", { event: SEEKER_LOCATION_EVENT }, ({ payload }) => {
        if (isStale(generation, callbackChannelGen)) {
          return;
        }
        const parsed = parseSeekerLocationPayload(payload);
        if (!parsed) {
          logHandoffLiveReceiver("payload rejected", {
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
          if (isStale(generation, callbackChannelGen)) {
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

      logHandoffLiveReceiver("subscribe", { claimId, topic, reason, generation });

      channel.subscribe((status) => {
        if (isStale(generation, callbackChannelGen)) {
          logHandoffLiveReceiver("stale channel status ignored", {
            generation,
            channelGeneration: callbackChannelGen,
            status,
            claimId,
          });
          return;
        }

        logHandoffLiveReceiver("channel status", {
          claimId,
          topic,
          status,
          generation,
          phase,
        });

        if (status === "SUBSCRIBED") {
          subscribeInFlight = false;
          phase = "subscribed";
          const snapshotReason = hadSubscribedRef.current ? "reconnect" : "post-subscribe";
          hadSubscribedRef.current = true;
          setSnapshot((prev) =>
            prev.generation === generation
              ? { ...prev, connectionFailed: false }
              : prev,
          );
          void reconcileLatestSnapshot(snapshotReason);
          scheduleWaitingSnapshotPoll();
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          subscribeInFlight = false;
          phase = "reconnecting";
          setSnapshot((prev) =>
            prev.generation === generation
              ? { ...prev, connectionFailed: true }
              : prev,
          );
          scheduleReconnect(status);
          return;
        }

        if (status === "CLOSED") {
          if (disposingChannel || phase !== "subscribed") {
            logHandoffLiveReceiver("channel closed ignored", {
              claimId,
              generation,
              disposingChannel,
              phase,
            });
            subscribeInFlight = false;
            if (phase === "subscribing") {
              phase = "idle";
            }
            return;
          }
          subscribeInFlight = false;
          phase = "reconnecting";
          setSnapshot((prev) =>
            prev.generation === generation
              ? { ...prev, connectionFailed: true }
              : prev,
          );
          scheduleReconnect("CLOSED");
        }
      });
    }

    void establishSubscription("mount");

    const {
      data: { subscription: authSubscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      if (cancelled || terminalRef.current || generation !== generationRef.current) {
        return;
      }
      if (session?.access_token && phase === "idle" && !subscribeInFlight) {
        void establishSubscription("auth ready");
      }
    });

    function onVisibilityRestore() {
      if (document.visibilityState !== "visible") {
        return;
      }
      if (phase !== "subscribed") {
        if (phase === "idle" || phase === "reconnecting") {
          void establishSubscription("visibility reconnect");
        }
        return;
      }
      void reconcileLatestSnapshot("visibility restore");
    }

    function onOnline() {
      if (phase !== "subscribed") {
        if (phase === "idle" || phase === "reconnecting") {
          void establishSubscription("network online");
        }
        return;
      }
      void reconcileLatestSnapshot("network online");
    }

    function onPageShow() {
      if (phase !== "subscribed") {
        if (phase === "idle" || phase === "reconnecting") {
          void establishSubscription("pageshow reconnect");
        }
        return;
      }
      void reconcileLatestSnapshot("pageshow");
    }

    function onWindowFocus() {
      if (phase !== "subscribed") {
        if (phase === "idle" || phase === "reconnecting") {
          void establishSubscription("window focus reconnect");
        }
        return;
      }
      void reconcileLatestSnapshot("window focus");
    }

    document.addEventListener("visibilitychange", onVisibilityRestore);
    window.addEventListener("online", onOnline);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("focus", onWindowFocus);

    return () => {
      cancelled = true;
      terminalRef.current = true;
      phase = "disposed";
      channelGenerationRef.current += 1;
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
      clearWaitingSnapshotPoll();
      authSubscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisibilityRestore);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("focus", onWindowFocus);
      const channel = channelRef.current;
      channelRef.current = null;
      if (channel) {
        disposingChannel = true;
        void client.removeChannel(channel).finally(() => {
          disposingChannel = false;
        });
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
