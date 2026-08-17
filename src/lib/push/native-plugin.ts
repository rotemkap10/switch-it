import { Capacitor } from "@capacitor/core";
import {
  PushNotifications,
  type PermissionStatus,
  type PushNotificationSchema,
  type Token,
} from "@capacitor/push-notifications";

import { isNativePushEnabledForPlatform } from "@/lib/push/is-native-push-platform";

export type NativePushPermission = "prompt" | "granted" | "denied";

function mapPermission(status: PermissionStatus): NativePushPermission {
  if (status.receive === "granted") {
    return "granted";
  }
  if (status.receive === "denied") {
    return "denied";
  }
  return "prompt";
}

export async function checkNativePushPermission(): Promise<NativePushPermission> {
  if (!isNativePushEnabledForPlatform()) {
    return "denied";
  }
  const status = await PushNotifications.checkPermissions();
  return mapPermission(status);
}

export async function requestNativePushPermission(): Promise<NativePushPermission> {
  if (!isNativePushEnabledForPlatform()) {
    return "denied";
  }
  const status = await PushNotifications.requestPermissions();
  return mapPermission(status);
}

export async function registerNativePush(): Promise<void> {
  if (!isNativePushEnabledForPlatform()) {
    return;
  }
  await PushNotifications.register();
}

export function addNativePushListeners(handlers: {
  onRegistration: (token: string) => void;
  onRegistrationError: (message: string) => void;
  onReceived: (notification: PushNotificationSchema) => void;
  onAction: (notification: PushNotificationSchema) => void;
}): () => void {
  if (!isNativePushEnabledForPlatform()) {
    return () => undefined;
  }

  const handles: { remove: () => Promise<void> }[] = [];

  void PushNotifications.addListener(
    "registration",
    (token: Token) => {
      handlers.onRegistration(token.value);
    },
  ).then((handle) => handles.push(handle));

  void PushNotifications.addListener("registrationError", (error) => {
    handlers.onRegistrationError(String(error.error ?? "registration_failed"));
  }).then((handle) => handles.push(handle));

  void PushNotifications.addListener(
    "pushNotificationReceived",
    (notification) => {
      handlers.onReceived(notification);
    },
  ).then((handle) => handles.push(handle));

  void PushNotifications.addListener(
    "pushNotificationActionPerformed",
    (action) => {
      handlers.onAction(action.notification);
    },
  ).then((handle) => handles.push(handle));

  return () => {
    void Promise.all(handles.map((handle) => handle.remove()));
    if (Capacitor.isPluginAvailable("PushNotifications")) {
      void PushNotifications.removeAllListeners();
    }
  };
}
