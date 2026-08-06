"use client";

import { useEffect } from "react";

function shouldRegisterServiceWorker(): boolean {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return false;
  }

  if (process.env.NODE_ENV === "production") {
    return true;
  }

  return process.env.NEXT_PUBLIC_PWA_DEV === "true";
}

/**
 * Registers the conservative PWA service worker in production only.
 * Failures are non-blocking and never surfaced to users.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!shouldRegisterServiceWorker()) {
      return;
    }

    let cancelled = false;

    void navigator.serviceWorker
      .register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      })
      .then((registration) => {
        if (!cancelled) {
          void registration.update();
        }
      })
      .catch(() => {
        // Non-blocking — app works without SW.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
