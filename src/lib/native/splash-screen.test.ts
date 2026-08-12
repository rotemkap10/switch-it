import { beforeEach, describe, expect, it, vi } from "vitest";

const hideMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@capacitor/splash-screen", () => ({
  SplashScreen: {
    hide: hideMock,
  },
}));

vi.mock("@/lib/location/is-native-handoff-platform", () => ({
  isNativeHandoffPlatform: vi.fn(() => false),
}));

import { isNativeHandoffPlatform } from "@/lib/location/is-native-handoff-platform";
import {
  hideNativeSplashScreen,
  resetNativeSplashHideForTests,
} from "@/lib/native/splash-screen";

describe("hideNativeSplashScreen", () => {
  beforeEach(() => {
    hideMock.mockClear();
    resetNativeSplashHideForTests();
    vi.mocked(isNativeHandoffPlatform).mockReturnValue(false);
  });

  it("does nothing on web", async () => {
    await hideNativeSplashScreen();
    expect(hideMock).not.toHaveBeenCalled();
  });

  it("hides the Capacitor splash once on native", async () => {
    vi.mocked(isNativeHandoffPlatform).mockReturnValue(true);

    await hideNativeSplashScreen();
    await hideNativeSplashScreen();

    expect(hideMock).toHaveBeenCalledTimes(1);
  });
});
