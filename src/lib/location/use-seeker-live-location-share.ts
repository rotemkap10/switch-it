"use client";

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  LIVE_LOCATION_GEO_OPTIONS,
  SEEKER_LOCATION_EVENT,
  SEEKER_LOCATION_STATUS_EVENT,
} from "@/lib/location/constants";
import { getHandoffLocationService } from "@/lib/location/handoff-location-service";
import { decideNativeTrackingReconcile } from "@/lib/location/handoff-native-reconcile";
import { getNativeHandoffPlugin } from "@/lib/location/native-handoff-plugin";
import {
  isUsableAccuracy,
  type SeekerLocationPayload,
} from "@/lib/location/payload";
import { shouldBroadcastLocation } from "@/lib/location/throttle";
import { logHandoffLive } from "@/lib/location/log-handoff-live";
import { getClaimLocationTopic } from "@/lib/location/topic";
import { geolocationErrorCodeToReason } from "@/lib/map/use-user-location";
import { createClient } from "@/lib/supabase/client";

export type SeekerShareUiState =
  | "idle"
  | "prompt"
  | "acquiring"
  | "waiting"
  | "weak"
  | "sharing"
  | "paused"
  | "unavailable"
  | "denied"
  | "off";

type UseSeekerLiveLocationShareOptions = {
  claimId: string;
  spotId?: string | null;
  /** ISO expires_at for the shared handoff deadline. */
  spotExpiresAtIso: string;
  enabled: boolean;
  /**
   * When false, this instance must not start or stop the native tracker.
   * Used by the unused duplicate hook inside ActiveClaimPanel when the parent
   * already owns sharing — otherwise `enabled: false` would kill GPS.
   */
  manageNativeTracker?: boolean;
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

async function refreshSeekerAccessToken(): Promise<string | null> {
  const client = createClient();
  const refreshed = await client.auth.refreshSession();
  const token =
    refreshed.data.session?.access_token ??
    (await client.auth.getSession()).data.session?.access_token ??
    null;
  return token;
}

/**
 * Seeker live-location share for one active claim.
 * Web/PWA: foreground-only watchPosition + private Broadcast.
 * Native app: single background GPS + HTTP bridge; does not pause when hidden.
 * Sharing is mandatory for the active handoff — stop only on terminal outcomes.
 */
export function useSeekerLiveLocationShare({
  claimId,
  spotId = null,
  spotExpiresAtIso,
  enabled,
  manageNativeTracker = true,
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
  const hasDeliveredRef = useRef(false);
  const pendingSampleRef = useRef<{
    latitude: number;
    longitude: number;
    accuracyMeters: number;
    headingDegrees: number | null;
    atMs: number;
  } | null>(null);
  const subscribedRef = useRef(false);
  const claimIdRef = useRef(claimId);
  const spotIdRef = useRef(spotId);
  const expiresAtRef = useRef(spotExpiresAtIso);
  const terminalRef = useRef(false);
  const uiEpochRef = useRef(0);
  const nativeListenerRef = useRef<{ remove: () => Promise<void> } | null>(
    null,
  );
  const nativePluginClaimRef = useRef<string | null>(null);
  const nativeStartInFlightRef = useRef<string | null>(null);
  const nativeStartSucceededRef = useRef<string | null>(null);
  const watchRetryTimerRef = useRef<number | null>(null);
  const startWatchRef = useRef<() => void>(() => {});

  useLayoutEffect(() => {
    claimIdRef.current = claimId;
    spotIdRef.current = spotId;
    expiresAtRef.current = spotExpiresAtIso;
    // Eligible claim must clear terminal from a prior no-claim cleanup before any
    // startSharing effect runs (layout runs before useEffect).
    if (enabled && claimId) {
      terminalRef.current = false;
    }
  }, [claimId, spotId, spotExpiresAtIso, enabled]);

  const clearWatch = useCallback(() => {
    if (watchRetryTimerRef.current !== null) {
      window.clearTimeout(watchRetryTimerRef.current);
      watchRetryTimerRef.current = null;
    }
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

  const detachNativeListener = useCallback(async () => {
    const listener = nativeListenerRef.current;
    nativeListenerRef.current = null;
    try {
      await listener?.remove();
    } catch {
      // ignore
    }
  }, []);

  const shutdown = useCallback(
    async (next: SeekerShareUiState = "off") => {
      sharingEnabledRef.current = false;
      clearWatch();
      lastSentRef.current = null;
      await detachNativeListener();
      await leaveChannel();
      setUiState(next);
    },
    [clearWatch, detachNativeListener, leaveChannel],
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
        pendingSampleRef.current = sample;
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
        pendingSampleRef.current = null;
        hasDeliveredRef.current = true;
        setUiState("sharing");
        logHandoffLive("web broadcast succeeded", {
          claimId: claimIdRef.current,
          sequence: payload.sequence,
        });
      } catch {
        // Do not queue history.
        setUiState("unavailable");
        logHandoffLive("web broadcast failed", {
          claimId: claimIdRef.current,
          sequence: payload.sequence,
        });
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
          logHandoffLive("gps rejected", {
            claimId: claimIdRef.current,
            provider: "geolocation",
            lat: latitude,
            lng: longitude,
            accuracy,
            timestamp: position.timestamp,
            ageMs: Date.now() - position.timestamp,
            reason: "unusable_accuracy",
          });
          if (!hasUsableFixRef.current) {
            setUiState("weak");
          }
          return;
        }
        hasUsableFixRef.current = true;
        // GPS accepted is not enough until the first successful broadcast.
        if (!hasDeliveredRef.current) {
          setUiState("acquiring");
        }
        logHandoffLive("gps accepted", {
          claimId: claimIdRef.current,
          provider: "geolocation",
          lat: latitude,
          lng: longitude,
          accuracy,
          timestamp: position.timestamp,
          ageMs: Date.now() - position.timestamp,
        });
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
        if (watchIdRef.current !== null && navigator.geolocation) {
          navigator.geolocation.clearWatch(watchIdRef.current);
        }
        watchIdRef.current = null;

        if (reason === "denied") {
          if (watchRetryTimerRef.current !== null) {
            window.clearTimeout(watchRetryTimerRef.current);
            watchRetryTimerRef.current = null;
          }
          sharingEnabledRef.current = false;
          setUiState("denied");
          void leaveChannel();
          return;
        }

        // Temporary GPS / timeout: keep the share intent. Publisher keeps the
        // last known marker and shows delayed freshness until updates resume.
        setUiState("unavailable");
        if (!sharingEnabledRef.current || terminalRef.current) {
          return;
        }
        if (watchRetryTimerRef.current !== null) {
          window.clearTimeout(watchRetryTimerRef.current);
        }
        watchRetryTimerRef.current = window.setTimeout(() => {
          watchRetryTimerRef.current = null;
          if (!sharingEnabledRef.current || terminalRef.current) {
            return;
          }
          setUiState(hasUsableFixRef.current ? "sharing" : "acquiring");
          startWatchRef.current();
        }, 3_000);
      },
      {
        enableHighAccuracy: LIVE_LOCATION_GEO_OPTIONS.enableHighAccuracy,
        maximumAge: LIVE_LOCATION_GEO_OPTIONS.maximumAgeMs,
        timeout: LIVE_LOCATION_GEO_OPTIONS.timeoutMs,
      },
    );
  }, [clearWatch, leaveChannel, publishSample]);

  useEffect(() => {
    startWatchRef.current = startWatch;
  }, [startWatch]);

  const ensureChannel = useCallback(async (): Promise<boolean> => {
    const topic = getClaimLocationTopic(claimIdRef.current);
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

      logHandoffLive("CHANNEL SUBSCRIBING", {
        claimId: claimIdRef.current,
        topic,
        role: "seeker",
      });
      nextChannel.subscribe((status) => {
        if (settled) {
          return;
        }
        if (status === "SUBSCRIBED") {
          settled = true;
          subscribedRef.current = true;
          logHandoffLive("CHANNEL SUBSCRIBED", {
            claimId: claimIdRef.current,
            topic,
            role: "seeker",
          });
          const pending = pendingSampleRef.current;
          if (pending) {
            void publishSample(pending);
          }
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
          logHandoffLive(`CHANNEL ${status}`, {
            claimId: claimIdRef.current,
            topic,
            role: "seeker",
          });
          resolve(false);
        }
      });
    });
  }, [leaveChannel, publishSample]);

  const attachNativeUiListener = useCallback(async () => {
    await detachNativeListener();
    const plugin = await getNativeHandoffPlugin();
    if (!plugin?.addListener) {
      return;
    }
    try {
      nativeListenerRef.current = await plugin.addListener(
        "handoffLocationState",
        (event) => {
          if (!sharingEnabledRef.current || terminalRef.current) {
            return;
          }
          if (event.uiState === "sharing") {
            hasUsableFixRef.current = true;
            hasDeliveredRef.current = true;
            setUiState("sharing");
            return;
          }
          if (event.uiState === "waiting") {
            if (!hasDeliveredRef.current) {
              setUiState("waiting");
            }
            return;
          }
          if (event.uiState === "unavailable") {
            setUiState("unavailable");
            return;
          }
          if (event.uiState === "denied") {
            setUiState("denied");
            return;
          }
          if (event.uiState === "weak" && !hasUsableFixRef.current) {
            setUiState("weak");
            return;
          }
          if (event.uiState === "acquiring" && !hasUsableFixRef.current) {
            setUiState("acquiring");
          }
        },
      );
    } catch {
      nativeListenerRef.current = null;
    }
  }, [detachNativeListener]);

  const startNativeSharing = useCallback(async () => {
    if (!manageNativeTracker) {
      return;
    }
    const service = getHandoffLocationService();
    const claimForStart = claimIdRef.current;
    sharingEnabledRef.current = true;
    hasUsableFixRef.current = false;
    setUiState("acquiring");

    logHandoffLive("nativePluginStart()", {
      claimId: claimForStart,
      provider: "native",
    });
    try {
      if (nativeStartInFlightRef.current === claimForStart) {
        logHandoffLive("nativePluginStart skipped duplicate", {
          claimId: claimForStart,
          alreadyRunning: true,
          reason: "in_flight",
        });
        await attachNativeUiListener();
        return;
      }

      if (nativePluginClaimRef.current === claimForStart) {
        const existingForSkip = await service.getTrackingState();
        if (
          existingForSkip.active &&
          existingForSkip.claimId === claimForStart
        ) {
          logHandoffLive("nativePluginStart skipped duplicate", {
            claimId: claimForStart,
            alreadyRunning: true,
          });
          await attachNativeUiListener();
          if (!hasDeliveredRef.current) {
            setUiState(hasUsableFixRef.current ? "waiting" : "acquiring");
          }
          return;
        }
        if (nativeStartSucceededRef.current === claimForStart) {
          // Plugin already accepted start for this claim in-session; avoid a
          // second startHandoffTracking while FGS is still reporting inactive.
          logHandoffLive("nativePluginStart skipped duplicate", {
            claimId: claimForStart,
            alreadyRunning: true,
            reason: "session_started",
          });
          await attachNativeUiListener();
          return;
        }
        // Sticky session ref after a failed/killed native start — allow retry.
        nativePluginClaimRef.current = null;
      }

      const existing = await service.getTrackingState();
      if (existing.active && existing.claimId === claimForStart) {
        sharingEnabledRef.current = true;
        nativePluginClaimRef.current = claimForStart;
        setUiState("acquiring");
        logHandoffLive("nativePluginStarted", {
          claimId: claimForStart,
          alreadyRunning: true,
        });
        await attachNativeUiListener();
        return;
      }

      const accessToken = await refreshSeekerAccessToken();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (!accessToken || !supabaseUrl || !publishableKey) {
        sharingEnabledRef.current = false;
        setUiState("unavailable");
        logHandoffLive("nativePluginStart() failed", {
          claimId: claimForStart,
          reason: "missing_session_or_config",
        });
        return;
      }

      nativeStartInFlightRef.current = claimForStart;
      const result = await service.startHandoffTracking({
        claimId: claimForStart,
        expiresAtIso: expiresAtRef.current,
        accessToken,
        supabaseUrl,
        supabasePublishableKey: publishableKey,
      });
      nativeStartInFlightRef.current = null;

      if (!result.ok) {
        sharingEnabledRef.current = false;
        setUiState(
          result.reason === "permission_denied" ? "denied" : "unavailable",
        );
        logHandoffLive("nativePluginStart() failed", {
          claimId: claimForStart,
          reason: result.reason,
        });
        return;
      }

      logHandoffLive("nativePluginStarted", {
        claimId: claimForStart,
        alreadyRunning: result.alreadyRunning === true,
      });
      nativePluginClaimRef.current = claimForStart;
      nativeStartSucceededRef.current = claimForStart;
      await attachNativeUiListener();
    } catch {
      nativeStartInFlightRef.current = null;
      sharingEnabledRef.current = false;
      setUiState("unavailable");
    }
  }, [attachNativeUiListener, manageNativeTracker]);

  const startSharing = useCallback(async () => {
    if (!enabled) {
      logHandoffLive("startSharing skipped", {
        reason: "not_enabled",
        claimId: claimIdRef.current,
      });
      return;
    }
    if (terminalRef.current) {
      logHandoffLive("startSharing skipped", {
        reason: "terminal",
        claimId: claimIdRef.current,
      });
      return;
    }
    uiEpochRef.current += 1;
    const expiresAtMs = new Date(expiresAtRef.current).getTime();
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
      setUiState("unavailable");
      logHandoffLive("startSharing skipped", {
        reason: "expired_or_invalid_deadline",
        claimId: claimIdRef.current,
      });
      return;
    }

    const service = getHandoffLocationService();
    const topic = getClaimLocationTopic(claimIdRef.current);
    if (service.isNative) {
      logHandoffLive("claim active", {
        claimId: claimIdRef.current,
        spotId: spotIdRef.current,
        topic,
        source: "native",
        provider: "native-plugin",
      });
      await startNativeSharing();
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
    logHandoffLive("claim active", {
      claimId: claimIdRef.current,
      spotId: spotIdRef.current,
      topic,
      source: "web",
      provider: "geolocation",
    });
    startWatch();

    const joined = await ensureChannel();
    if (!joined) {
      sharingEnabledRef.current = false;
      clearWatch();
      setUiState("unavailable");
    }
  }, [clearWatch, enabled, ensureChannel, startNativeSharing, startWatch]);

  const stopSharing = useCallback(async () => {
    uiEpochRef.current += 1;
    nativeStartSucceededRef.current = null;
    nativeStartInFlightRef.current = null;
    nativePluginClaimRef.current = null;
    await sendStatus("stopped");
    if (manageNativeTracker) {
      await getHandoffLocationService().stopHandoffTracking("explicit_stop");
      logHandoffLive("nativePluginStop()", {
        claimId: claimIdRef.current,
        reason: "explicit_stop",
      });
    }
    await shutdown("off");
  }, [manageNativeTracker, sendStatus, shutdown]);

  /**
   * Terminal handoff paths (complete / cancel / expire): best-effort
   * "stopped" so the publisher clears live UI, then leave channel + watch.
   */
  const forceStop = useCallback(() => {
    terminalRef.current = true;
    uiEpochRef.current += 1;
    nativeStartSucceededRef.current = null;
    nativeStartInFlightRef.current = null;
    nativePluginClaimRef.current = null;
    void (async () => {
      await sendStatus("stopped");
      if (manageNativeTracker) {
        await getHandoffLocationService().stopHandoffTracking("terminal");
        logHandoffLive("nativePluginStop()", {
          claimId: claimIdRef.current,
          reason: "terminal",
        });
      }
      await shutdown("idle");
    })();
  }, [manageNativeTracker, sendStatus, shutdown]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const onVisibility = () => {
      if (getHandoffLocationService().isNative) {
        return;
      }
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
    // Reconcile native tracker with the current claim. Do NOT flip terminalRef in
    // cleanup — that blocked startSharing after no-claim → active-claim because
    // parent/layout effects could observe terminal=true across the transition.
    sharingEnabledRef.current = false;
    hasUsableFixRef.current = false;
    hasDeliveredRef.current = false;
    pendingSampleRef.current = null;
    nativePluginClaimRef.current = null;
    nativeStartInFlightRef.current = null;
    nativeStartSucceededRef.current = null;
    clearWatch();
    void leaveChannel();
    const epoch = ++uiEpochRef.current;
    let cancelled = false;
    let idleTimer: number | null = null;

    void (async () => {
      const service = getHandoffLocationService();
      if (service.isNative && manageNativeTracker) {
        try {
          const state = await service.getTrackingState();
          if (cancelled || uiEpochRef.current !== epoch) {
            return;
          }
          const decision = decideNativeTrackingReconcile({
            enabled,
            currentClaimId: claimId,
            expiresAtIso: expiresAtRef.current,
            nativeActive: state.active,
            nativeClaimId: state.claimId,
          });
          if (decision.action === "stop") {
            await service.stopHandoffTracking(decision.reason);
          } else if (decision.action === "keep") {
            sharingEnabledRef.current = true;
            nativePluginClaimRef.current = claimId;
            // Native tracker alive ≠ publisher receiving. Wait for POST success.
            setUiState("acquiring");
            setResumedOnce(false);
            await attachNativeUiListener();
            return;
          }
        } catch {
          // Fall through to idle; parent startSharing still owns first start.
        }
      }
      if (cancelled || uiEpochRef.current !== epoch) {
        return;
      }
      idleTimer = window.setTimeout(() => {
        if (uiEpochRef.current !== epoch) {
          return;
        }
        setUiState("idle");
        setResumedOnce(false);
      }, 0);
    })();

    return () => {
      cancelled = true;
      if (idleTimer !== null) {
        window.clearTimeout(idleTimer);
      }
      // Leave terminalRef alone — only forceStop / expiry / explicit stop set it.
      sharingEnabledRef.current = false;
      clearWatch();
      void leaveChannel();
      // Native tracker outlives React remounts (revalidatePath / navigation).
    };
  }, [claimId, enabled, manageNativeTracker, clearWatch, leaveChannel, attachNativeUiListener]);

  return {
    uiState,
    resumedOnce,
    startSharing,
    stopSharing,
    forceStop,
  };
}

export type SeekerLiveLocationShareApi = ReturnType<
  typeof useSeekerLiveLocationShare
>;
