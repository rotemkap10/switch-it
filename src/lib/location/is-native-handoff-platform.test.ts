import { describe, expect, it, vi, afterEach } from "vitest";

import { isNativeHandoffPlatform } from "@/lib/location/is-native-handoff-platform";

describe("isNativeHandoffPlatform", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is false for web/PWA", () => {
    expect(isNativeHandoffPlatform()).toBe(false);
  });

  it("is true only when Capacitor reports a native platform", () => {
    vi.stubGlobal("window", {
      ...window,
      Capacitor: { isNativePlatform: () => true },
    });
    expect(isNativeHandoffPlatform()).toBe(true);
  });
});
