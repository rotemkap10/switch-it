"use client";

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  LIVE_LOCATION_GEO_OPTIONS,
  SEEKER_LOCATION_EVENT,
  SEEKER_LOCATION_STATUS_EVENT,
} from "@/lib/location/constants";
import {
  isUsableAccuracy,
  type SeekerLocationPayload,
} from "@/lib/location/payload";
import { shouldBroadcastLocation } from "@/lib/location/throttle";
import { claimLocationTopic } from "@/lib/location/topic";
import { geolocationErrorCodeToReason } from "@/lib/map/use-user-location";
import { createClient } from "@/lib/supabase/client";

export type SeekerShareUiState =
  | "idle"
  | "prompt"
  | "acquiring"
  | "weak"
  | "sharing"
  | "paused"
  | "unavailable"
  | "denied"
  | "off";

type UseSeekerLiveLocationShareOptions = {
  claimId: string;
  /** ISO expires_at for the shared handoff deadline. */
  spotExpiresAtIso: string;
  enabled: boolean;
};

function isSecureGeolocationAvailable(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  if (!window.isSecureContext) {
    return false;
  }
  return "geolocation" in navigator && !!navigator.geolocation;
}

/**
 * Foreground-only seeker live-location share for one active claim.
 * Consent is in-memory for this claim only — never persisted.
 */
export function useSeekerLiveLocationShare({
  claimId,
  spotExpiresAtIso,
  enabled,
}: UseSeekerLiveLocationShareOptions) {
  const [uiState, setUiState] = useState<SeekerShareUiState>("idle");
  const [resumedOnce, setResumedOnce] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const clientRef = useRef<SupabaseClient | null>(null);
  const sequenceRef = useRef(0);
  const lastSentRef = useRef<{
    latitude: number;
    longitude: number;
    accuracyMeters: number;
    headingDegrees: number | null;
    atMs: number;
  } | null>(null);
  const sharingEnabledRef = useRef(false);
  const hasUsableFixRef = useRef(false);
  const subscribedRef = useRef(false);
  const claimIdRef = useRef(claimId);
  const expiresAtRef = useRef(spotExpiresAtIso);
  const terminalRef = useRef(false);
  const uiEpochRef = useRef(0);

  useEffect(() => {
    claimIdRef.current = claimId;
    expiresAtRef.current = spotExpiresAtIso;
  }, [claimId, spotExpiresAtIso]);

  const clearWatch = useCallback(() => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
  }, []);

  const leaveChannel = useCallback(async () => {
    subscribedRef.current = false;
    const channel = channelRef.current;
    const client = clientRef.current;
    channelRef.current = null;
    if (channel && client) {
      await client.removeChannel(channel);
    }
  }, []);

  const shutdown = useCallback(
    async (next: SeekerShareUiState = "off") => {
      sharingEnabledRef.current = false;
      clearWatch();
      lastSentRef.current = null;
      await leaveChannel();
      setUiState(next);
    },
    [clearWatch, leaveChannel],
  );

  const sendStatus = useCallback(async (status: "paused" | "stopped") => {
    const channel = channelRef.current;
    if (!channel || !subscribedRef.current) {
      return;
    }
    sequenceRef.current += 1;
    try {
      await channel.send({
        type: "broadcast",
        event: SEEKER_LOCATION_STATUS_EVENT,
        payload: {
          status,
          sequence: sequenceRef.current,
          sentAt: Date.now(),
        },
      });
    } catch {
      // Best-effort; do not log payloads.
    }
  }, []);

  const publishSample = useCallback(
    async (sample: {
      latitude: number;
      longitude: number;
      accuracyMeters: number;
      headingDegrees: number | null;
      atMs: number;
    }) => {
      if (!sharingEnabledRef.current || terminalRef.current) {
        return;
      }
      if (!subscribedRef.current || !channelRef.current) {
        return;
      }
      if (new Date(expiresAtRef.current).getTime() <= Date.now()) {
        terminalRef.current = true;
        await shutdown("off");
        return;
      }

      const decision = shouldBroadcastLocation(lastSentRef.current, sample);
      if (!decision.send) {
        return;
      }

      sequenceRef.current += 1;
      const payload: SeekerLocationPayload = {
        latitude: sample.latitude,
        longitude: sample.longitude,
        accuracyMeters: sample.accuracyMeters,
        headingDegrees: sample.headingDegrees,
        sequence: sequenceRef.current,
        sentAt: Date.now(),
      };

      try {
        await channelRef.current.send({
          type: "broadcast",
          event: SEEKER_LOCATION_EVENT,
          payload,
        });
        lastSentRef.current = sample;
      } catch {
        // Do not queue history.
      }
    },
    [shutdown],
  );

  const startWatch = useCallback(() => {
    clearWatch();
    if (!isSecureGeolocationAvailable()) {
      setUiState("unavailable");
      sharingEnabledRef.current = false;
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        if (!sharingEnabledRef.current || terminalRef.current) {
          return;
        }
        const { latitude, longitude, accuracy, heading } = position.coords;
        if (!isUsableAccuracy(accuracy)) {
          if (!hasUsableFixRef.current) {
            setUiState("weak");
          }
          return;
        }
        hasUsableFixRef.current = true;
        setUiState("sharing");
        const headingDegrees =
          typeof heading === "number" && Number.isFinite(heading)
            ? ((heading % 360) + 360) % 360
            : null;
        void publishSample({
          latitude,
          longitude,
          accuracyMeters: accuracy,
          headingDegrees,
          atMs: Date.now(),
        });
      },
      (error) => {
        const reason = geolocationErrorCodeToReason(error.code);
        clearWatch();
        sharingEnabledRef.current = false;
        if (reason === "denied") {
          setUiState("denied");
        } else {
          setUiState("unavailable");
        }
        void leaveChannel();
      },
      {
        enableHighAccuracy: LIVE_LOCATION_GEO_OPTIONS.enableHighAccuracy,
        maximumAge: LIVE_LOCATION_GEO_OPTIONS.maximumAgeMs,
        timeout: LIVE_LOCATION_GEO_OPTIONS.timeoutMs,
      },
    );
  }, [clearWatch, leaveChannel, publishSample]);

  const ensureChannel = useCallback(async (): Promise<boolean> => {
    const topic = claimLocationTopic(claimIdRef.current);
    if (!topic) {
      return false;
    }

    await leaveChannel();

    const client = createClient();
    clientRef.current = client;

    const { data } = await client.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      return false;
    }
    await client.realtime.setAuth(token);

    return await new Promise<boolean>((resolve) => {
      let settled = false;
      const nextChannel = client.channel(topic, {
        config: {
          private: true,
          broadcast: { self: false, ack: true },
        },
      });
      channelRef.current = nextChannel;

      nextChannel.subscribe((status) => {
        if (settled) {
          return;
        }
        if (status === "SUBSCRIBED") {
          settled = true;
          subscribedRef.current = true;
          resolve(true);
          return;
        }
        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          settled = true;
          subscribedRef.current = false;
          resolve(false);
        }
      });
    });
  }, [leaveChannel]);

  const startSharing = useCallback(async () => {
    if (!enabled || terminalRef.current) {
      return;
    }
    uiEpochRef.current += 1;
    if (new Date(expiresAtRef.current).getTime() <= Date.now()) {
      return;
    }
    if (!isSecureGeolocationAvailable()) {
      setUiState("unavailable");
      return;
    }

    // Start watch in this turn so iOS can still treat it as a user gesture.
    sharingEnabledRef.current = true;
    hasUsableFixRef.current = false;
    setUiState("acquiring");
    startWatch();

    const joined = await ensureChannel();
    if (!joined) {
      sharingEnabledRef.current = false;
      clearWatch();
      setUiState("unavailable");
    }
  }, [clearWatch, enabled, ensureChannel, startWatch]);

  const stopSharing = useCallback(async () => {
    uiEpochRef.current += 1;
    await sendStatus("stopped");
    await shutdown("off");
  }, [sendStatus, shutdown]);

  /**
   * Terminal handoff paths (complete / cancel / expire): best-effort
   * "stopped" so the publisher clears live UI, then leave channel + watch.
   */
  const forceStop = useCallback(() => {
    terminalRef.current = true;
    uiEpochRef.current += 1;
    void (async () => {
      await sendStatus("stopped");
      await shutdown("idle");
    })();
  }, [sendStatus, shutdown]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (sharingEnabledRef.current) {
          clearWatch();
          void sendStatus("paused");
          setUiState("paused");
        }
        return;
      }

      if (
        sharingEnabledRef.current &&
        !terminalRef.current &&
        document.visibilityState === "visible"
      ) {
        setResumedOnce(true);
        setUiState(hasUsableFixRef.current ? "sharing" : "acquiring");
        void (async () => {
          const ok = await ensureChannel();
          if (!ok) {
            setUiState("unavailable");
            sharingEnabledRef.current = false;
            return;
          }
          startWatch();
        })();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [clearWatch, enabled, ensureChannel, sendStatus, startWatch]);

  useEffect(() => {
    terminalRef.current = false;
    sharingEnabledRef.current = false;
    hasUsableFixRef.current = false;
    clearWatch();
    void leaveChannel();
    const epoch = ++uiEpochRef.current;
    const id = window.setTimeout(() => {
      if (uiEpochRef.current !== epoch) {
        return;
      }
      setUiState("idle");
      setResumedOnce(false);
    }, 0);
    return () => {
      window.clearTimeout(id);
      terminalRef.current = true;
      sharingEnabledRef.current = false;
      clearWatch();
      void leaveChannel();
    };
  }, [claimId, enabled, clearWatch, leaveChannel]);

  return {
    uiState,
    resumedOnce,
    startSharing,
    stopSharing,
    forceStop,
  };
}
