import { triggerSensoryHaptic, type SensoryHapticKind } from "@/lib/sensory/haptics";
import {
  consumeSensoryOnce,
  decidePublisherClaimFeedback,
} from "@/lib/sensory/once";
import { readSensoryPreferences } from "@/lib/sensory/preferences";
import {
  playBundledSound,
  type SensorySoundName,
} from "@/lib/sensory/sounds";

export type SensoryAdapters = {
  playSound: (name: SensorySoundName) => void;
  haptic: (kind: SensoryHapticKind) => void | Promise<void>;
  readPrefs?: typeof readSensoryPreferences;
};

const defaultAdapters: SensoryAdapters = {
  playSound: playBundledSound,
  haptic: (kind) => {
    void triggerSensoryHaptic(kind);
  },
  readPrefs: readSensoryPreferences,
};

let adapters: SensoryAdapters = defaultAdapters;

export function setSensoryAdaptersForTests(next: Partial<SensoryAdapters>): void {
  adapters = { ...defaultAdapters, ...next };
}

export function resetSensoryAdaptersForTests(): void {
  adapters = defaultAdapters;
}

function emit(sound: SensorySoundName | null, haptic: SensoryHapticKind | null): void {
  try {
    const prefs = (adapters.readPrefs ?? readSensoryPreferences)();
    if (sound && prefs.sounds) {
      adapters.playSound(sound);
    }
    if (haptic && prefs.haptics) {
      void Promise.resolve(adapters.haptic(haptic)).catch(() => {
        // Haptic failure must never surface.
      });
    }
  } catch {
    // Sensory feedback is never allowed to break a parking action.
  }
}

/** Subtle positive cue after a spot is published. */
export function sensorySuccess(): void {
  emit("success", "success");
}

/**
 * Publisher: a driver claimed the spot.
 * Dedupes by claim ID (or spot ID fallback) so refetch/reconnect/remount
 * cannot replay the same claim.
 */
export function sensoryClaimReceived(input: {
  previousStatus: string | null;
  nextStatus: string;
  claimId?: string | null;
  spotId: string;
}): boolean {
  try {
    const decision = decidePublisherClaimFeedback(input);
    if (!decision.play) {
      return false;
    }
    if (!consumeSensoryOnce(decision.dedupeKey)) {
      return false;
    }
    emit("claimReceived", "medium");
    return true;
  } catch {
    return false;
  }
}

/** Seeker or publisher: this handoff finished. Once per claim ID. */
export function sensoryHandoffCompleted(claimId: string): boolean {
  try {
    const id = claimId.trim();
    if (!id) {
      return false;
    }
    if (!consumeSensoryOnce(`handoff-completed:${id}`)) {
      return false;
    }
    emit("handoffCompleted", "success");
    return true;
  } catch {
    return false;
  }
}

/** Optional haptic-only cue for an explicit important tap (no sound). */
export function sensoryLightTap(): void {
  emit(null, "light");
}
