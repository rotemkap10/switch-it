"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useMode } from "@/components/mode/ModeProvider";
import {
  CORE_MODE_ROUTES,
  markRoutePrefetched,
  readPrefetchSaveData,
  scheduleIdle,
  shouldDeferRoutePrefetch,
  shouldPrefetchRoute,
} from "@/lib/navigation/core-route-prefetch";

/**
 * Prefetch /map and /spots/new once after the authenticated shell is ready.
 * Respects Save-Data when the Network Information API is present.
 */
export function CoreRoutePrefetch() {
  const router = useRouter();
  const { ready } = useMode();

  useEffect(() => {
    if (
      shouldDeferRoutePrefetch({
        ready,
        saveData: readPrefetchSaveData(),
      })
    ) {
      return;
    }

    return scheduleIdle(() => {
      for (const href of CORE_MODE_ROUTES) {
        if (!shouldPrefetchRoute(href)) {
          continue;
        }
        markRoutePrefetched(href);
        try {
          router.prefetch(href);
        } catch {
          // Prefetch is best-effort.
        }
      }
    });
  }, [ready, router]);

  return null;
}
