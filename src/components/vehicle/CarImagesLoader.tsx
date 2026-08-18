"use client";

import { useEffect } from "react";

import {
  CARIMAGES_LOADER_ERROR_EVENT,
  CARIMAGES_TYPE,
  carImagesLoaderScriptUrl,
  getCarImagesPublicApiKey,
  isCarImagesLoaderEnabled,
  logCarImages,
} from "@/lib/vehicle/carimages";

const LOADER_ATTR = "data-switch-it-carimages-loader";

function notifyLoaderFailed(): void {
  logCarImages("loader script failed");
  window.dispatchEvent(new Event(CARIMAGES_LOADER_ERROR_EVENT));
}

/**
 * Official CarImages JS loader. The public API key is intended for the
 * browser; signing still happens on their server (Referer / domain checks).
 */
export function CarImagesLoader({
  priority = false,
}: {
  /** High fetch priority for above-the-fold handoff / profile images. */
  priority?: boolean;
}) {
  useEffect(() => {
    if (!isCarImagesLoaderEnabled()) {
      return;
    }

    const apiKey = getCarImagesPublicApiKey();
    if (!apiKey) {
      return;
    }

    const existing = document.querySelector(`script[${LOADER_ATTR}]`);
    if (existing instanceof HTMLScriptElement) {
      if (priority) {
        existing.fetchPriority = "high";
      }
      return;
    }

    window.CI_API_KEY = apiKey;
    window.CI_DEFAULT_TYPE = CARIMAGES_TYPE;

    const script = document.createElement("script");
    script.async = true;
    script.src = carImagesLoaderScriptUrl();
    if (priority) {
      script.fetchPriority = "high";
    }
    script.setAttribute("data-api-key", apiKey);
    script.setAttribute(LOADER_ATTR, "true");
    logCarImages("loader script requested");
    script.addEventListener("load", () => {
      logCarImages("loader script loaded");
    });
    script.addEventListener("error", notifyLoaderFailed);
    document.head.appendChild(script);
  }, [priority]);

  return null;
}
