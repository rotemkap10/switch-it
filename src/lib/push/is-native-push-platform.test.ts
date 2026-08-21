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
  ANDROID_FCM_PUSH_ENABLED,
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

  it("keeps Android FCM dormant until google-services.json is configured", () => {
    expect(ANDROID_FCM_PUSH_ENABLED).toBe(false);
    isNativePlatform.mockReturnValue(true);
    getPlatform.mockReturnValue("android");
    expect(isNativePushEnabledForPlatform()).toBe(false);
  });

  it("does not enable web push", () => {
    isNativePlatform.mockReturnValue(false);
    getPlatform.mockReturnValue("web");
    expect(isNativePushEnabledForPlatform()).toBe(false);
  });
});
