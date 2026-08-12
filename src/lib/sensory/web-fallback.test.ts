import { afterEach, describe, expect, it, vi } from "vitest";

import { triggerSensoryHaptic } from "@/lib/sensory/haptics";
import { playBundledSound } from "@/lib/sensory/sounds";

describe("web sensory fallbacks", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.doUnmock("@/lib/location/is-native-handoff-platform");
  });

  it("skips audio when Audio is unavailable", () => {
    vi.stubGlobal("Audio", undefined);
    expect(() => playBundledSound("success")).not.toThrow();
  });

  it("swallows a rejected play() without throwing", () => {
    vi.stubGlobal(
      "Audio",
      class {
        volume = 1;
        preload = "";
        play() {
          return Promise.reject(new DOMException("NotAllowedError"));
        }
      },
    );
    expect(() => playBundledSound("success")).not.toThrow();
  });

  it("no-ops haptics off native platforms", async () => {
    await expect(triggerSensoryHaptic("light")).resolves.toBeUndefined();
  });
});
