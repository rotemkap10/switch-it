"use client";

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  SEEKER_LOCATION_EVENT,
  SEEKER_LOCATION_STATUS_EVENT,
} from "@/lib/location/constants";
import {
  parseSeekerLocationPayload,
  parseSeekerLocationStatusPayload,
  type SeekerLocationPayload,
} from "@/lib/location/payload";
import {
  liveLocationFreshness,
  liveLocationStatusLabel,
  liveLocationUpdatedLabel,
  type LiveLocationFreshness,
} from "@/lib/location/stale";
import { claimLocationTopic } from "@/lib/location/topic";
import { createClient } from "@/lib/supabase/client";

export type PublisherLiveLocationState = {
  freshness: LiveLocationFreshness;
  statusLabel: string;
  updatedLabel: string;
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
  generation: number;
};

const EMPTY_SNAPSHOT: LiveSnapshot = {
  location: null,
  lastReceivedAtMs: null,
  explicitPaused: false,
  generation: 0,
};

/**
 * Publisher subscription to private seeker-location Broadcast for one claim.
 * Positions exist only in memory — never persisted.
 */
export function usePublisherLiveLocation({
  claimId,
  enabled,
}: UsePublisherLiveLocationOptions): PublisherLiveLocationState & {
  clear: () => void;
} {
  const active = enabled && !!claimId;
  const [snapshot, setSnapshot] = useState<LiveSnapshot>(EMPTY_SNAPSHOT);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const channelRef = useRef<RealtimeChannel | null>(null);
  const clientRef = useRef<SupabaseClient | null>(null);
  const lastSequenceRef = useRef(0);
  const terminalRef = useRef(false);
  const generationRef = useRef(0);

  const clear = useCallback(() => {
    terminalRef.current = true;
    lastSequenceRef.current = 0;
    generationRef.current += 1;
    setSnapshot({
      location: null,
      lastReceivedAtMs: null,
      explicitPaused: false,
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
    lastSequenceRef.current = 0;
    const generation = ++generationRef.current;

    const topic = claimLocationTopic(claimId);
    if (!topic) {
      return;
    }

    let cancelled = false;
    const client = createClient();
    clientRef.current = client;

    void (async () => {
      const { data } = await client.auth.getSession();
      const token = data.session?.access_token;
      if (!token || cancelled) {
        return;
      }
      await client.realtime.setAuth(token);
      if (cancelled) {
        return;
      }

      // Reset visible state asynchronously after join setup (avoids sync setState-in-effect).
      setSnapshot({
        location: null,
        lastReceivedAtMs: null,
        explicitPaused: false,
        generation,
      });

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
          return;
        }
        if (parsed.sequence <= lastSequenceRef.current) {
          return;
        }
        lastSequenceRef.current = parsed.sequence;
        setSnapshot({
          location: parsed,
          lastReceivedAtMs: Date.now(),
          explicitPaused: false,
          generation,
        });
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

      channel.subscribe();
    })();

    return () => {
      cancelled = true;
      terminalRef.current = true;
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
      location: null,
      lastReceivedAtMs: null,
      clear,
    };
  }

  let freshness = liveLocationFreshness(snapshot.lastReceivedAtMs, nowMs);
  if (snapshot.explicitPaused && freshness !== "waiting") {
    freshness = "paused";
  }

  return {
    freshness,
    statusLabel: liveLocationStatusLabel(freshness),
    updatedLabel: liveLocationUpdatedLabel(
      freshness,
      snapshot.lastReceivedAtMs,
      nowMs,
    ),
    location: snapshot.location,
    lastReceivedAtMs: snapshot.lastReceivedAtMs,
    clear,
  };
}
