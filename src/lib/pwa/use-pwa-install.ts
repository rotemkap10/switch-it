"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  type BeforeInstallPromptEvent,
  isIosAddToHomeScreenEligible,
  isStandaloneDisplayMode,
  type PwaInstallCapability,
  resolvePwaInstallCapability,
  shouldShowInstallMenuItem,
} from "@/lib/pwa/install-state";

export type UsePwaInstallResult = {
  capability: PwaInstallCapability;
  showInstallEntry: boolean;
  /** Opens Chromium install prompt or iOS instruction sheet. */
  requestInstallUi: () => void;
  iosSheetOpen: boolean;
  closeIosSheet: () => void;
};

export function usePwaInstall(): UsePwaInstallResult {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [clientReady, setClientReady] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [hasDeferredPrompt, setHasDeferredPrompt] = useState(false);
  const [iosEligible, setIosEligible] = useState(false);
  const [iosSheetOpen, setIosSheetOpen] = useState(false);

  useEffect(() => {
    const readyTimer = window.setTimeout(() => {
      setStandalone(isStandaloneDisplayMode());
      setIosEligible(isIosAddToHomeScreenEligible());
      setClientReady(true);
    }, 0);

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      deferredPromptRef.current = event as BeforeInstallPromptEvent;
      setHasDeferredPrompt(true);
    }

    function onAppInstalled() {
      deferredPromptRef.current = null;
      setHasDeferredPrompt(false);
      setStandalone(true);
      setIosSheetOpen(false);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.clearTimeout(readyTimer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const capability = resolvePwaInstallCapability({
    standalone,
    hasDeferredPrompt,
    iosEligible,
    clientReady,
  });

  const requestInstallUi = useCallback(async () => {
    if (capability === "chromium-installable") {
      const promptEvent = deferredPromptRef.current;
      if (!promptEvent) {
        return;
      }

      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      deferredPromptRef.current = null;
      setHasDeferredPrompt(false);

      if (choice.outcome === "accepted") {
        setStandalone(true);
      }
      return;
    }

    if (capability === "ios-instructions") {
      setIosSheetOpen(true);
    }
  }, [capability]);

  const closeIosSheet = useCallback(() => {
    setIosSheetOpen(false);
  }, []);

  return {
    capability,
    showInstallEntry: shouldShowInstallMenuItem(capability),
    requestInstallUi,
    iosSheetOpen,
    closeIosSheet,
  };
}
