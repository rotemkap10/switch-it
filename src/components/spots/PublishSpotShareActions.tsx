"use client";

import {
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/** Matches Tailwind `md` — below this, Share CTA is viewport-fixed via portal. */
export const PUBLISHER_MOBILE_CTA_MEDIA_QUERY = "(max-width: 767.98px)";

export const PUBLISH_SPOT_FORM_ID = "publish-spot-form";

export function usePublisherMobileViewportCta(): boolean {
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useLayoutEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const media = window.matchMedia(PUBLISHER_MOBILE_CTA_MEDIA_QUERY);
    const sync = () => {
      setIsMobileViewport(media.matches);
    };
    sync();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", sync);
      return () => media.removeEventListener("change", sync);
    }

    media.addListener(sync);
    return () => media.removeListener(sync);
  }, []);

  return isMobileViewport;
}

/**
 * Renders the Share spot actions inline on desktop.
 * On mobile, portals to document.body so position:fixed is truly viewport-relative
 * (ancestors with CSS transform — mode transition / motion utilities — otherwise
 * create a containing block and pin the CTA below the fold).
 */
export function PublishSpotShareActions({
  children,
  viewportFixed,
}: {
  children: ReactNode;
  viewportFixed: boolean;
}) {
  const actions = (
    <div
      className={[
        "publisher-compose-actions",
        viewportFixed ? "publisher-compose-actions--viewport" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-testid="publish-spot-actions"
      data-viewport-fixed={viewportFixed ? "true" : "false"}
    >
      {children}
    </div>
  );

  if (viewportFixed && typeof document !== "undefined") {
    return createPortal(actions, document.body);
  }

  return actions;
}
