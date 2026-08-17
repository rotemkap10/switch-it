import { createClient } from "@/lib/supabase/client";
import { getOrCreateDeviceInstallId } from "@/lib/push/device-install-id";
import {
  isNativePushEnabledForPlatform,
  nativePushPlatform,
} from "@/lib/push/is-native-push-platform";
import { logPush, tokenSuffix } from "@/lib/push/log-push";

export async function uploadPushDeviceToken(token: string): Promise<void> {
  if (!isNativePushEnabledForPlatform()) {
    return;
  }
  const platform = nativePushPlatform();
  if (!platform) {
    return;
  }
  const installId = getOrCreateDeviceInstallId();
  const client = createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    logPush("device register skipped unauthenticated");
    return;
  }

  logPush("device registered", {
    userId: user.id,
    platform,
    tokenSuffix: tokenSuffix(token),
  });

  const { error } = await client.rpc("upsert_push_device", {
    p_platform: platform,
    p_push_token: token,
    p_device_install_id: installId,
  });
  if (error) {
    logPush("device register failed", { message: error.message });
  }
}

export async function disableCurrentPushDevice(): Promise<void> {
  if (!isNativePushEnabledForPlatform()) {
    return;
  }
  const installId = getOrCreateDeviceInstallId();
  const client = createClient();
  const { error } = await client.rpc("disable_push_device", {
    p_device_install_id: installId,
  });
  if (error) {
    logPush("device disable failed", { message: error.message });
  }
}
