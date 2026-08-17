import { describe, expect, it, vi } from "vitest";

const getPlatform = vi.fn(() => "web");
const isNativePlatform = vi.fn(() => false);

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform(),
    getPlatform: () => getPlatform(),
  },
}));

import {
  IOS_APNS_PUSH_ENABLED,
  isNativePushEnabledForPlatform,
} from "@/lib/push/is-native-push-platform";

describe("isNativePushEnabledForPlatform", () => {
  it("keeps iOS APNs dormant for Personal Team builds", () => {
    expect(IOS_APNS_PUSH_ENABLED).toBe(false);
    isNativePlatform.mockReturnValue(true);
    getPlatform.mockReturnValue("ios");
    expect(isNativePushEnabledForPlatform()).toBe(false);
  });

  it("enables Android FCM independently", () => {
    isNativePlatform.mockReturnValue(true);
    getPlatform.mockReturnValue("android");
    expect(isNativePushEnabledForPlatform()).toBe(true);
  });

  it("does not enable web push", () => {
    isNativePlatform.mockReturnValue(false);
    getPlatform.mockReturnValue("web");
    expect(isNativePushEnabledForPlatform()).toBe(false);
  });
});
