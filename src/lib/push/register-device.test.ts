import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const rpc = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser },
    rpc,
  }),
}));

vi.mock("@/lib/push/is-native-push-platform", () => ({
  nativePushPlatform: () => "android",
  isNativePushEnabledForPlatform: () => true,
}));

vi.mock("@/lib/push/device-install-id", () => ({
  getOrCreateDeviceInstallId: () => "install-device-1",
}));

import {
  disableCurrentPushDevice,
  uploadPushDeviceToken,
} from "@/lib/push/register-device";

describe("push device registration", () => {
  beforeEach(() => {
    getUser.mockReset();
    rpc.mockReset();
    rpc.mockResolvedValue({ error: null });
  });

  it("does not upload a token without an authenticated user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await uploadPushDeviceToken("apns-token-abcdefghijklmnopqrstuvwxyz");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("upserts the token for the authenticated user and install", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });
    await uploadPushDeviceToken("apns-token-abcdefghijklmnopqrstuvwxyz");
    expect(rpc).toHaveBeenCalledWith("upsert_push_device", {
      p_platform: "android",
      p_push_token: "apns-token-abcdefghijklmnopqrstuvwxyz",
      p_device_install_id: "install-device-1",
    });
  });

  it("logout disables only the current installation", async () => {
    await disableCurrentPushDevice();
    expect(rpc).toHaveBeenCalledWith("disable_push_device", {
      p_device_install_id: "install-device-1",
    });
  });
});
