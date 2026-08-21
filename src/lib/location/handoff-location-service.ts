import { handoffSeekerLocationEdgeFunctionUrl } from "@/lib/location/handoff-native-broadcast";
import type {
  HandoffTrackingStartInput,
  HandoffTrackingStartResult,
  HandoffTrackingState,
} from "@/lib/location/handoff-location-types";
import { isNativeHandoffPlatform } from "@/lib/location/is-native-handoff-platform";
import { getNativeHandoffPlugin } from "@/lib/location/native-handoff-plugin";

export type HandoffLocationService = {
  isNative: boolean;
  startHandoffTracking(
    input: HandoffTrackingStartInput,
  ): Promise<HandoffTrackingStartResult>;
  stopHandoffTracking(reason?: string): Promise<void>;
  getTrackingState(): Promise<HandoffTrackingState>;
};

function webService(): HandoffLocationService {
  return {
    isNative: false,
    async startHandoffTracking() {
      return { ok: true, source: "web" };
    },
    async stopHandoffTracking() {
      return;
    },
    async getTrackingState() {
      return { active: false, claimId: null, source: null };
    },
  };
}

function nativeService(): HandoffLocationService {
  return {
    isNative: true,
    async startHandoffTracking(input) {
      const expiresAtEpochMs = new Date(input.expiresAtIso).getTime();
      if (!Number.isFinite(expiresAtEpochMs) || expiresAtEpochMs <= Date.now()) {
        return { ok: false, reason: "expired" };
      }
      if (!input.accessToken) {
        return { ok: false, reason: "no_session" };
      }
      const plugin = await getNativeHandoffPlugin();
      if (!plugin) {
        return { ok: false, reason: "unavailable" };
      }
      try {
        const result = await plugin.startHandoffTracking({
          claimId: input.claimId,
          expiresAtEpochMs,
          accessToken: input.accessToken,
          supabaseUrl: input.supabaseUrl,
          publishableKey: input.supabasePublishableKey,
          edgeFunctionUrl: handoffSeekerLocationEdgeFunctionUrl(input.supabaseUrl),
        });
        if (!result.started) {
          if (result.reason === "permission_denied") {
            return { ok: false, reason: "permission_denied" };
          }
          if (result.reason === "expired") {
            return { ok: false, reason: "expired" };
          }
          if (result.reason === "invalid_claim") {
            return { ok: false, reason: "invalid_claim" };
          }
          // foreground_start_denied / unavailable — claim stays live; UI shows off.
          return { ok: false, reason: "unavailable" };
        }
        return { ok: true, source: "native", alreadyRunning: result.alreadyRunning === true };
      } catch {
        return { ok: false, reason: "unavailable" };
      }
    },
    async stopHandoffTracking(reason) {
      const plugin = await getNativeHandoffPlugin();
      try {
        await plugin?.stopHandoffTracking(reason ? { reason } : undefined);
      } catch {
        // Best-effort stop.
      }
    },
    async getTrackingState() {
      const plugin = await getNativeHandoffPlugin();
      if (!plugin) {
        return { active: false, claimId: null, source: null };
      }
      try {
        const state = await plugin.getTrackingState();
        return {
          active: Boolean(state.active),
          claimId: state.claimId ?? null,
          source: state.active ? "native" : null,
        };
      } catch {
        return { active: false, claimId: null, source: null };
      }
    },
  };
}

let overrideForTests: HandoffLocationService | null = null;

export function getHandoffLocationService(): HandoffLocationService {
  if (overrideForTests) {
    return overrideForTests;
  }
  return isNativeHandoffPlatform() ? nativeService() : webService();
}

export function setHandoffLocationServiceForTests(
  service: HandoffLocationService | null,
): void {
  overrideForTests = service;
}

/** Best-effort native stop for logout / claim change (no-op on web). */
export async function stopHandoffTrackingBestEffort(
  reason = "logout",
): Promise<void> {
  await getHandoffLocationService().stopHandoffTracking(reason);
}
