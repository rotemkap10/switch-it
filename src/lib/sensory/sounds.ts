export const SENSORY_SOUND_URLS = {
  success: "/sounds/success.wav",
  claimReceived: "/sounds/claim-received.wav",
  handoffCompleted: "/sounds/handoff-complete.wav",
} as const;

export type SensorySoundName = keyof typeof SENSORY_SOUND_URLS;

/**
 * Play a bundled cue. Autoplay blocks and missing Audio are silent no-ops.
 * Never retries a blocked play.
 */
export function playBundledSound(name: SensorySoundName): void {
  if (typeof window === "undefined" || typeof Audio === "undefined") {
    return;
  }

  const url = SENSORY_SOUND_URLS[name];
  const audio = new Audio(url);
  audio.preload = "auto";
  audio.volume = 0.7;
  const result = audio.play();
  if (result && typeof result.catch === "function") {
    void result.catch(() => {
      // Autoplay policy or missing asset — skip.
    });
  }
}

let audioUnlockInstalled = false;

/** One-time silent unlock after the first user gesture. Does not retry. */
export function installSensoryAudioUnlock(): void {
  if (typeof window === "undefined" || audioUnlockInstalled) {
    return;
  }
  audioUnlockInstalled = true;

  const unlock = () => {
    try {
      const audio = new Audio(SENSORY_SOUND_URLS.success);
      audio.volume = 0;
      const result = audio.play();
      if (result && typeof result.then === "function") {
        void result
          .then(() => {
            audio.pause();
            audio.currentTime = 0;
          })
          .catch(() => {
            // Still blocked — leave it; later plays may succeed after more interaction.
          });
      }
    } catch {
      // Ignore.
    }
  };

  window.addEventListener("pointerdown", unlock, { once: true });
}

export function resetSensoryAudioUnlockForTests() {
  audioUnlockInstalled = false;
}
