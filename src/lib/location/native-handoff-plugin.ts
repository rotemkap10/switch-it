import type {
  HandoffTrackingState,
  NativeHandoffPluginStartOptions,
} from "@/lib/location/handoff-location-types";
import { isNativeHandoffPlatform } from "@/lib/location/is-native-handoff-platform";

export type NativeHandoffPlugin = {
  startHandoffTracking(
    options: NativeHandoffPluginStartOptions,
  ): Promise<{ started: boolean; alreadyRunning?: boolean; reason?: string }>;
  stopHandoffTracking(options?: { reason?: string }): Promise<void>;
  getTrackingState(): Promise<{
    active: boolean;
    claimId?: string | null;
  }>;
  addListener?(
    eventName: "handoffLocationState",
    listener: (event: {
      uiState: "acquiring" | "waiting" | "weak" | "sharing" | "unavailable" | "denied";
    }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
};

type CapacitorBridge = {
  isNativePlatform?: () => boolean;
  Plugins?: Record<string, NativeHandoffPlugin | undefined>;
  registerPlugin?: <T>(name: string) => T;
};

function capacitorBridge(): CapacitorBridge | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  return (window as unknown as { Capacitor?: CapacitorBridge }).Capacitor;
}

export async function getNativeHandoffPlugin(): Promise<NativeHandoffPlugin | null> {
  if (!isNativeHandoffPlatform()) {
    return null;
  }
  const capacitor = capacitorBridge();
  const existing = capacitor?.Plugins?.HandoffBackgroundLocation;
  if (existing) {
    return existing;
  }
  if (typeof capacitor?.registerPlugin === "function") {
    try {
      return capacitor.registerPlugin<NativeHandoffPlugin>(
        "HandoffBackgroundLocation",
      );
    } catch {
      return null;
    }
  }
  return null;
}

export async function readNativeTrackingState(): Promise<HandoffTrackingState> {
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
}
