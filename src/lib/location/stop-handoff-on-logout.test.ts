import { describe, expect, it, vi } from "vitest";

const stopHandoffTrackingBestEffort = vi.fn(async () => undefined);
const disableCurrentPushDevice = vi.fn(async () => undefined);

vi.mock("@/lib/location/handoff-location-service", () => ({
  stopHandoffTrackingBestEffort: (...args: unknown[]) =>
    stopHandoffTrackingBestEffort(...args),
}));

vi.mock("@/lib/push/register-device", () => ({
  disableCurrentPushDevice: (...args: unknown[]) =>
    disableCurrentPushDevice(...args),
}));

vi.mock("@/lib/push/is-native-push-platform", () => ({
  isNativePushEnabledForPlatform: () => true,
}));

import { onLogoutSubmit } from "@/lib/location/stop-handoff-on-logout";

describe("logout stops native handoff tracking", () => {
  it("F. stops tracking on logout submit", () => {
    onLogoutSubmit();
    expect(stopHandoffTrackingBestEffort).toHaveBeenCalledWith("logout");
    expect(disableCurrentPushDevice).toHaveBeenCalled();
  });
});
