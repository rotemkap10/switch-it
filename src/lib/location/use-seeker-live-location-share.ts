"use client";

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";

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
  const nativeListenerRef = useRef<{ remove: () => Promise<void> } | null>(
    null,
  );

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
            setUiState("sharing");
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
    const service = getHandoffLocationService();
    sharingEnabledRef.current = true;
    hasUsableFixRef.current = false;
    setUiState("acquiring");

    try {
      const existing = await service.getTrackingState();
      if (existing.active && existing.claimId === claimIdRef.current) {
        sharingEnabledRef.current = true;
        hasUsableFixRef.current = true;
        setUiState("sharing");
        await attachNativeUiListener();
        return;
      }

      const accessToken = await refreshSeekerAccessToken();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (!accessToken || !supabaseUrl || !publishableKey) {
        sharingEnabledRef.current = false;
        setUiState("unavailable");
        return;
      }

      const result = await service.startHandoffTracking({
        claimId: claimIdRef.current,
        expiresAtIso: expiresAtRef.current,
        accessToken,
        supabaseUrl,
        supabasePublishableKey: publishableKey,
      });

      if (!result.ok) {
        sharingEnabledRef.current = false;
        setUiState(
          result.reason === "permission_denied" ? "denied" : "unavailable",
        );
        return;
      }

      await attachNativeUiListener();
    } catch {
      sharingEnabledRef.current = false;
      setUiState("unavailable");
    }
  }, [attachNativeUiListener]);

  const startSharing = useCallback(async () => {
    if (!enabled || terminalRef.current) {
      return;
    }
    uiEpochRef.current += 1;
    if (new Date(expiresAtRef.current).getTime() <= Date.now()) {
      return;
    }

    const service = getHandoffLocationService();
    if (service.isNative) {
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
    await sendStatus("stopped");
    await getHandoffLocationService().stopHandoffTracking("explicit_stop");
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
      await getHandoffLocationService().stopHandoffTracking("terminal");
      await shutdown("idle");
    })();
  }, [sendStatus, shutdown]);

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
    terminalRef.current = false;
    sharingEnabledRef.current = false;
    hasUsableFixRef.current = false;
    clearWatch();
    void leaveChannel();
    const epoch = ++uiEpochRef.current;
    let cancelled = false;
    let idleTimer: number | null = null;

    void (async () => {
      const service = getHandoffLocationService();
      if (service.isNative) {
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
            hasUsableFixRef.current = true;
            setUiState("sharing");
            setResumedOnce(false);
            return;
          }
        } catch {
          // Fall through to idle.
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
      terminalRef.current = true;
      sharingEnabledRef.current = false;
      clearWatch();
      void leaveChannel();
      // Native tracker outlives React remounts (revalidatePath / navigation).
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
