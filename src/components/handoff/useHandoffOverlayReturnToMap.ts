"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { HANDOFF_COMPLETION_OVERLAY_FADE_MS } from "@/lib/handoff/handoff-completion-success";
import { prepareFindParkingAfterHandoff } from "@/lib/handoff/prepare-find-parking-after-handoff";
import {
  HANDOFF_COMPLETION_MAP_READY_FALLBACK_MS,
  isSeekerMapReadyForHandoffReturn,
  subscribeSeekerMapPresentation,
} from "@/lib/map/seeker-map-presentation";

/**
 * Shared post-handoff return: prepare `/map` under the overlay, wait for a
 * real map-ready signal, then fade. Continue skips the minimum readable time
 * but still waits for readiness.
 */
export function useHandoffOverlayReturnToMap({
  activeId,
  minVisibleMs,
  dismiss,
}: {
  activeId: string | null;
  minVisibleMs: number;
  dismiss: () => void;
}): { exiting: boolean; onContinue: () => void } {
  const router = useRouter();
  const pathname = usePathname();
  const [exiting, setExiting] = useState(false);
  const activeIdRef = useRef<string | null>(null);
  const shownAtRef = useRef(0);
  const skipMinVisibleRef = useRef(false);
  const exitingRef = useRef(false);
  const preparedIdRef = useRef<string | null>(null);
  const fadeTimerRef = useRef<number | null>(null);
  const dismissRef = useRef(dismiss);
  const minVisibleMsRef = useRef(minVisibleMs);

  useEffect(() => {
    dismissRef.current = dismiss;
  }, [dismiss]);

  useEffect(() => {
    minVisibleMsRef.current = minVisibleMs;
  }, [minVisibleMs]);

  const clearFadeTimer = useCallback(() => {
    if (fadeTimerRef.current != null) {
      window.clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  }, []);

  const beginExit = useCallback(() => {
    if (exitingRef.current || !activeIdRef.current) {
      return;
    }
    exitingRef.current = true;
    setExiting(true);
    clearFadeTimer();
    fadeTimerRef.current = window.setTimeout(() => {
      fadeTimerRef.current = null;
      dismissRef.current();
      setExiting(false);
      exitingRef.current = false;
      skipMinVisibleRef.current = false;
      preparedIdRef.current = null;
    }, HANDOFF_COMPLETION_OVERLAY_FADE_MS);
  }, [clearFadeTimer]);

  const tryFinish = useCallback(() => {
    const currentId = activeIdRef.current;
    if (!currentId || exitingRef.current) {
      return;
    }
    const minElapsed =
      skipMinVisibleRef.current ||
      Date.now() - shownAtRef.current >= minVisibleMsRef.current;
    if (!minElapsed) {
      return;
    }
    if (!isSeekerMapReadyForHandoffReturn(currentId)) {
      return;
    }
    beginExit();
  }, [beginExit]);

  useEffect(() => {
    if (!activeId) {
      activeIdRef.current = null;
      preparedIdRef.current = null;
      skipMinVisibleRef.current = false;
      if (!exitingRef.current) {
        setExiting(false);
      }
      return;
    }

    activeIdRef.current = activeId;
    shownAtRef.current = Date.now();

    const unsubPresentation = subscribeSeekerMapPresentation(() => {
      tryFinish();
    });
    const minTimer = window.setTimeout(tryFinish, minVisibleMsRef.current);
    const fallbackTimer = window.setTimeout(() => {
      beginExit();
    }, HANDOFF_COMPLETION_MAP_READY_FALLBACK_MS);

    tryFinish();

    return () => {
      window.clearTimeout(minTimer);
      window.clearTimeout(fallbackTimer);
      unsubPresentation();
    };
  }, [activeId, tryFinish, beginExit]);

  useEffect(() => {
    if (!activeId) {
      return;
    }
    if (preparedIdRef.current === activeId) {
      return;
    }
    preparedIdRef.current = activeId;
    prepareFindParkingAfterHandoff(pathname, {
      replace: (href) => {
        router.replace(href);
      },
      refresh: () => {
        router.refresh();
      },
      prefetch: (href) => {
        router.prefetch(href);
      },
    });
  }, [activeId, pathname, router]);

  useEffect(() => {
    return () => {
      clearFadeTimer();
    };
  }, [clearFadeTimer]);

  const onContinue = useCallback(() => {
    skipMinVisibleRef.current = true;
    tryFinish();
  }, [tryFinish]);

  return { exiting, onContinue };
}
