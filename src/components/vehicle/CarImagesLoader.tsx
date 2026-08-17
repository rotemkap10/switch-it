"use client";

import { useEffect } from "react";

import {
  CARIMAGES_LOADER_SRC,
  CARIMAGES_TYPE,
  carImagesLoaderCacheBust,
  getCarImagesPublicApiKey,
  isCarImagesLoaderEnabled,
} from "@/lib/vehicle/carimages";

const LOADER_ATTR = "data-switch-it-carimages-loader";

/**
 * Official CarImages JS loader. The public API key is intended for the
 * browser; signing still happens on their server (Referer / domain checks).
 */
export function CarImagesLoader() {
  useEffect(() => {
    if (!isCarImagesLoaderEnabled()) {
      return;
    }

    const apiKey = getCarImagesPublicApiKey();
    if (!apiKey || document.querySelector(`script[${LOADER_ATTR}]`)) {
      return;
    }

    window.CI_API_KEY = apiKey;
    window.CI_DEFAULT_TYPE = CARIMAGES_TYPE;

    const script = document.createElement("script");
    script.async = true;
    script.src = `${CARIMAGES_LOADER_SRC}?v=${carImagesLoaderCacheBust()}`;
    script.setAttribute("data-api-key", apiKey);
    script.setAttribute(LOADER_ATTR, "true");
    document.head.appendChild(script);
  }, []);

  return null;
}
