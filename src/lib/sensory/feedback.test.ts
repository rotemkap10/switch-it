import { afterEach, describe, expect, it, vi } from "vitest";

import {
  resetSensoryAdaptersForTests,
  sensoryClaimReceived,
  sensoryHandoffCompleted,
  sensoryLightTap,
  sensorySuccess,
  setSensoryAdaptersForTests,
} from "@/lib/sensory/feedback";
import { resetSensoryOnceForTests } from "@/lib/sensory/once";
import { DEFAULT_SENSORY_PREFERENCES } from "@/lib/sensory/preferences";

describe("sensory feedback", () => {
  afterEach(() => {
    resetSensoryAdaptersForTests();
    resetSensoryOnceForTests();
  });

  it("does not play audio when sounds are disabled", () => {
    const playSound = vi.fn();
    const haptic = vi.fn();
    setSensoryAdaptersForTests({
      playSound,
      haptic,
      readPrefs: () => ({ sounds: false, haptics: true }),
    });

    sensorySuccess();

    expect(playSound).not.toHaveBeenCalled();
    expect(haptic).toHaveBeenCalledWith("success");
  });

  it("does not trigger haptics when haptics are disabled", () => {
    const playSound = vi.fn();
    const haptic = vi.fn();
    setSensoryAdaptersForTests({
      playSound,
      haptic,
      readPrefs: () => ({ sounds: true, haptics: false }),
    });

    sensorySuccess();

    expect(playSound).toHaveBeenCalledWith("success");
    expect(haptic).not.toHaveBeenCalled();
  });

  it("never throws when adapters fail", () => {
    setSensoryAdaptersForTests({
      playSound: () => {
        throw new Error("audio exploded");
      },
      haptic: () => {
        throw new Error("haptic exploded");
      },
      readPrefs: () => DEFAULT_SENSORY_PREFERENCES,
    });

    expect(() => sensorySuccess()).not.toThrow();
    expect(() => sensoryLightTap()).not.toThrow();
    expect(() =>
      sensoryClaimReceived({
        previousStatus: "available",
        nextStatus: "claimed",
        claimId: "claim-a",
        spotId: "spot-a",
      }),
    ).not.toThrow();
    expect(() => sensoryHandoffCompleted("claim-a")).not.toThrow();
  });

  it("plays publish success once per call", () => {
    const playSound = vi.fn();
    const haptic = vi.fn();
    setSensoryAdaptersForTests({ playSound, haptic });

    sensorySuccess();

    expect(playSound).toHaveBeenCalledTimes(1);
    expect(playSound).toHaveBeenCalledWith("success");
    expect(haptic).toHaveBeenCalledWith("success");
  });

  it("notifies a new publisher claim once", () => {
    const playSound = vi.fn();
    const haptic = vi.fn();
    setSensoryAdaptersForTests({ playSound, haptic });

    const first = sensoryClaimReceived({
      previousStatus: "available",
      nextStatus: "claimed",
      claimId: "claim-1",
      spotId: "spot-1",
    });
    const again = sensoryClaimReceived({
      previousStatus: "available",
      nextStatus: "claimed",
      claimId: "claim-1",
      spotId: "spot-1",
    });

    expect(first).toBe(true);
    expect(again).toBe(false);
    expect(playSound).toHaveBeenCalledTimes(1);
    expect(playSound).toHaveBeenCalledWith("claimReceived");
    expect(haptic).toHaveBeenCalledWith("medium");
  });

  it("does not notify when the same claimed state is observed without an available→claimed transition", () => {
    const playSound = vi.fn();
    setSensoryAdaptersForTests({ playSound, haptic: vi.fn() });

    expect(
      sensoryClaimReceived({
        previousStatus: null,
        nextStatus: "claimed",
        claimId: "claim-1",
        spotId: "spot-1",
      }),
    ).toBe(false);
    expect(
      sensoryClaimReceived({
        previousStatus: "claimed",
        nextStatus: "claimed",
        claimId: "claim-1",
        spotId: "spot-1",
      }),
    ).toBe(false);
    expect(playSound).not.toHaveBeenCalled();
  });

  it("can notify a different new claim", () => {
    const playSound = vi.fn();
    setSensoryAdaptersForTests({ playSound, haptic: vi.fn() });

    expect(
      sensoryClaimReceived({
        previousStatus: "available",
        nextStatus: "claimed",
        claimId: "claim-1",
        spotId: "spot-1",
      }),
    ).toBe(true);
    expect(
      sensoryClaimReceived({
        previousStatus: "available",
        nextStatus: "claimed",
        claimId: "claim-2",
        spotId: "spot-1",
      }),
    ).toBe(true);
    expect(playSound).toHaveBeenCalledTimes(2);
  });

  it("plays handoff completion once per claim", () => {
    const playSound = vi.fn();
    const haptic = vi.fn();
    setSensoryAdaptersForTests({ playSound, haptic });

    expect(sensoryHandoffCompleted("claim-9")).toBe(true);
    expect(sensoryHandoffCompleted("claim-9")).toBe(false);
    expect(playSound).toHaveBeenCalledTimes(1);
    expect(playSound).toHaveBeenCalledWith("handoffCompleted");
    expect(haptic).toHaveBeenCalledWith("success");
  });

  it("light tap is haptic-only", () => {
    const playSound = vi.fn();
    const haptic = vi.fn();
    setSensoryAdaptersForTests({ playSound, haptic });

    sensoryLightTap();

    expect(playSound).not.toHaveBeenCalled();
    expect(haptic).toHaveBeenCalledWith("light");
  });
});
