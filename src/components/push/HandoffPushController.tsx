"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { HandoffPushPreprompt } from "@/components/push/HandoffPushPreprompt";
import { NotificationsOffBanner } from "@/components/push/NotificationsOffBanner";
import {
  isNativePushEnabledForPlatform,
  nativePushPlatform,
} from "@/lib/push/is-native-push-platform";
import { logPush, tokenSuffix } from "@/lib/push/log-push";
import {
  addNativePushListeners,
  checkNativePushPermission,
  registerNativePush,
  requestNativePushPermission,
  type NativePushPermission,
} from "@/lib/push/native-plugin";
import { parseHandoffPushPayload } from "@/lib/push/payload";
import { registerHandoffPushPrepromptHandler } from "@/lib/push/preprompt-bus";
import {
  hasShownHandoffPushPreprompt,
  markHandoffPushPrepromptShown,
} from "@/lib/push/preprompt-storage";
import { reconcileHandoffFromPush } from "@/lib/push/reconcile";
import { uploadPushDeviceToken } from "@/lib/push/register-device";

type HandoffPushControllerProps = {
  userId: string;
  hasActiveHandoff: boolean;
};

/**
 * Native-only handoff push: listeners, permission preprompt, token upload.
 * Does not request OS permission on launch.
 */
export function HandoffPushController({
  userId,
  hasActiveHandoff,
}: HandoffPushControllerProps) {
  const router = useRouter();
  const [permission, setPermission] = useState<NativePushPermission | null>(
    null,
  );
  const [showPreprompt, setShowPreprompt] = useState(false);
  const registeredRef = useRef(false);
  const permissionRef = useRef<NativePushPermission | null>(null);
  const prepromptWaiterRef = useRef<(() => void) | null>(null);

  const startRegistration = useCallback(async () => {
    if (registeredRef.current) {
      return;
    }
    registeredRef.current = true;
    logPush("registration started");
    await registerNativePush();
  }, []);

  const finishPreprompt = useCallback(() => {
    prepromptWaiterRef.current?.();
    prepromptWaiterRef.current = null;
  }, []);

  const openPreprompt = useCallback((): Promise<void> => {
    if (!isNativePushEnabledForPlatform()) {
      return Promise.resolve();
    }
    if (permissionRef.current === "granted" || permissionRef.current === "denied") {
      return Promise.resolve();
    }
    if (hasShownHandoffPushPreprompt()) {
      return Promise.resolve();
    }
    logPush("permission preprompt shown");
    setShowPreprompt(true);
    return new Promise((resolve) => {
      prepromptWaiterRef.current = resolve;
    });
  }, []);

  useEffect(() => {
    permissionRef.current = permission;
  }, [permission]);

  useEffect(() => {
    registerHandoffPushPrepromptHandler(() => openPreprompt());
    return () => {
      registerHandoffPushPrepromptHandler(null);
    };
  }, [openPreprompt]);

  useEffect(() => {
    if (!isNativePushEnabledForPlatform()) {
      if (nativePushPlatform() === "android") {
        logPush("android push disabled until FCM is configured");
      }
      return;
    }

    let cancelled = false;
    void (async () => {
      const current = await checkNativePushPermission();
      if (cancelled) {
        return;
      }
      setPermission(current);
      if (current === "granted") {
        await startRegistration();
      }
    })();

    const remove = addNativePushListeners({
      onRegistration: (token) => {
        logPush("registration success", {
          platform: "native",
          tokenSuffix: tokenSuffix(token),
        });
        void uploadPushDeviceToken(token);
      },
      onRegistrationError: (message) => {
        logPush("registration failed", { message });
        registeredRef.current = false;
      },
      onReceived: (notification) => {
        const parsed = parseHandoffPushPayload(notification.data);
        logPush("push received foreground", {
          type: parsed?.type ?? "unknown",
        });
        router.refresh();
      },
      onAction: (notification) => {
        const parsed = parseHandoffPushPayload(notification.data);
        if (!parsed) {
          router.refresh();
          return;
        }
        void reconcileHandoffFromPush(parsed, (path) => {
          router.push(path);
          router.refresh();
        });
      },
    });

    return () => {
      cancelled = true;
      remove();
    };
  }, [router, startRegistration, userId]);

  useEffect(() => {
    if (!hasActiveHandoff || permission !== "prompt") {
      return;
    }
    const id = window.setTimeout(() => {
      void openPreprompt();
    }, 0);
    return () => window.clearTimeout(id);
  }, [hasActiveHandoff, openPreprompt, permission]);

  async function onEnable() {
    markHandoffPushPrepromptShown();
    setShowPreprompt(false);
    finishPreprompt();
    const result = await requestNativePushPermission();
    logPush("permission result", { result });
    setPermission(result);
    if (result === "granted") {
      await startRegistration();
    }
  }

  function onNotNow() {
    markHandoffPushPrepromptShown();
    setShowPreprompt(false);
    logPush("permission result", { result: "not_now" });
    finishPreprompt();
  }

  if (!isNativePushEnabledForPlatform()) {
    return null;
  }

  return (
    <>
      {showPreprompt ? (
        <HandoffPushPreprompt onEnable={() => void onEnable()} onNotNow={onNotNow} />
      ) : null}
      {hasActiveHandoff && permission === "denied" ? (
        <NotificationsOffBanner />
      ) : null}
    </>
  );
}
