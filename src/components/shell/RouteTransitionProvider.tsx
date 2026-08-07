"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { BrandedLoadingState } from "@/components/brand/BrandedLoadingState";
import { useAppLaunchReady } from "@/components/shell/AppLaunchReadyContext";
import {
  ROUTE_TRANSITION_MIN_VISIBLE_MS,
  ROUTE_TRANSITION_REVEAL_DELAY_MS,
  ROUTE_TRANSITION_SAFETY_TIMEOUT_MS,
  isModifiedClick,
  resolveAnchorHref,
  shouldStartRouteTransition,
} from "@/lib/motion/route-transition";

type RouteTransitionContextValue = {
  /** Start a client-driven transition (ModeSwitch, programmatic push). */
  beginRouteTransition: (href?: string) => void;
  /** Clear pending transition without waiting for destination. */
  cancelRouteTransition: () => void;
  isTransitioning: boolean;
};

const RouteTransitionContext =
  createContext<RouteTransitionContextValue | null>(null);

export function useRouteTransition(): RouteTransitionContextValue {
  const value = useContext(RouteTransitionContext);
  if (!value) {
    return {
      beginRouteTransition: () => {},
      cancelRouteTransition: () => {},
      isTransitioning: false,
    };
  }
  return value;
}

type RouteTransitionProviderProps = {
  children: ReactNode;
};

function windowLocationKey(): string {
  return `${window.location.pathname}?${window.location.search.replace(/^\?/, "")}`;
}

/**
 * Full-page branded parking-pin loader for internal navigations.
 * Complements Next.js loading.tsx; anti-flicker reveal / min-visible timings.
 */
export function RouteTransitionProvider({
  children,
}: RouteTransitionProviderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? "";
  const locationKey = `${pathname}?${search}`;
  const launchReady = useAppLaunchReady();

  const [pending, setPending] = useState(false);
  const [visuallyVisible, setVisuallyVisible] = useState(false);

  const pendingRef = useRef(false);
  const visuallyVisibleRef = useRef(false);
  const visibleSinceRef = useRef<number | null>(null);
  const revealTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const safetyTimerRef = useRef<number | null>(null);
  const historySettleTimerRef = useRef<number | null>(null);
  /** Location key when a soft navigation started (Link / router.push). */
  const startedForKeyRef = useRef<string | null>(null);
  /** History traversal — complete once React location matches the window URL. */
  const fromHistoryRef = useRef(false);
  const locationKeyRef = useRef(locationKey);
  const launchReadyRef = useRef(launchReady);

  useEffect(() => {
    locationKeyRef.current = locationKey;
  }, [locationKey]);

  useEffect(() => {
    launchReadyRef.current = launchReady;
  }, [launchReady]);

  const clearTimers = useCallback(() => {
    if (revealTimerRef.current != null) {
      window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (safetyTimerRef.current != null) {
      window.clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
    if (historySettleTimerRef.current != null) {
      window.clearTimeout(historySettleTimerRef.current);
      historySettleTimerRef.current = null;
    }
  }, []);

  const hideNow = useCallback(() => {
    pendingRef.current = false;
    visuallyVisibleRef.current = false;
    fromHistoryRef.current = false;
    startedForKeyRef.current = null;
    visibleSinceRef.current = null;
    setPending(false);
    setVisuallyVisible(false);
    clearTimers();
  }, [clearTimers]);

  const finishTransition = useCallback(() => {
    if (!pendingRef.current) {
      return;
    }

    // Never became visible — cancel without flash.
    if (!visuallyVisibleRef.current || visibleSinceRef.current == null) {
      hideNow();
      return;
    }

    const elapsed = Date.now() - visibleSinceRef.current;
    const remaining = ROUTE_TRANSITION_MIN_VISIBLE_MS - elapsed;
    if (remaining <= 0) {
      hideNow();
      return;
    }

    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = window.setTimeout(hideNow, remaining);
  }, [hideNow]);

  const beginRouteTransition = useCallback(
    (href?: string, options?: { fromHistory?: boolean }) => {
      if (!launchReadyRef.current) {
        return;
      }

      if (href && !options?.fromHistory) {
        try {
          const url = new URL(href, window.location.origin);
          const nextKey = `${url.pathname}?${url.searchParams.toString()}`;
          if (nextKey === windowLocationKey()) {
            return;
          }
        } catch {
          // Continue — still a navigation attempt.
        }
      }

      clearTimers();
      pendingRef.current = true;
      visuallyVisibleRef.current = false;
      fromHistoryRef.current = Boolean(options?.fromHistory);
      startedForKeyRef.current = windowLocationKey();
      setPending(true);
      setVisuallyVisible(false);
      visibleSinceRef.current = null;

      revealTimerRef.current = window.setTimeout(() => {
        if (!pendingRef.current) {
          return;
        }
        visibleSinceRef.current = Date.now();
        visuallyVisibleRef.current = true;
        setVisuallyVisible(true);
      }, ROUTE_TRANSITION_REVEAL_DELAY_MS);

      safetyTimerRef.current = window.setTimeout(() => {
        finishTransition();
      }, ROUTE_TRANSITION_SAFETY_TIMEOUT_MS);

      // History traversal updates the address bar before React; if React already
      // matches, complete on the next task without waiting for a key change.
      if (options?.fromHistory) {
        historySettleTimerRef.current = window.setTimeout(() => {
          historySettleTimerRef.current = null;
          if (
            pendingRef.current &&
            fromHistoryRef.current &&
            locationKeyRef.current === windowLocationKey()
          ) {
            finishTransition();
          }
        }, 0);
      }
    },
    [clearTimers, finishTransition],
  );

  const cancelRouteTransition = useCallback(() => {
    hideNow();
  }, [hideNow]);

  // Complete when the destination route is ready (pathname/search settled).
  useEffect(() => {
    if (!pendingRef.current) {
      return;
    }

    if (fromHistoryRef.current) {
      if (locationKey === windowLocationKey()) {
        finishTransition();
      }
      return;
    }

    // Ignore the location we started from.
    if (startedForKeyRef.current === locationKey) {
      return;
    }
    finishTransition();
  }, [locationKey, finishTransition]);

  // Capture internal Link clicks.
  useEffect(() => {
    function onClickCapture(event: MouseEvent) {
      if (event.defaultPrevented) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const anchor = target.closest("a");
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }
      if (anchor.hasAttribute("download")) {
        return;
      }

      const href = resolveAnchorHref(anchor);
      const ok = shouldStartRouteTransition({
        href,
        currentPathname: window.location.pathname,
        currentSearch: window.location.search,
        target: anchor.getAttribute("target"),
        download: anchor.hasAttribute("download"),
        modifiedClick: isModifiedClick(event),
      });
      if (!ok) {
        return;
      }
      beginRouteTransition(href ?? undefined);
    }

    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, [beginRouteTransition]);

  // Browser back/forward — start pending; complete when React matches window URL.
  useEffect(() => {
    function onPopState() {
      beginRouteTransition(undefined, { fromHistory: true });
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [beginRouteTransition]);

  useEffect(() => {
    return () => {
      clearTimers();
      pendingRef.current = false;
    };
  }, [clearTimers]);

  const value = useMemo(
    () => ({
      beginRouteTransition: (href?: string) => beginRouteTransition(href),
      cancelRouteTransition,
      isTransitioning: pending,
    }),
    [beginRouteTransition, cancelRouteTransition, pending],
  );

  // Never stack under the cold-start splash.
  const showOverlay = launchReady && pending && visuallyVisible;

  return (
    <RouteTransitionContext.Provider value={value}>
      {children}
      {showOverlay ? (
        <div
          className="route-transition-overlay"
          data-testid="route-transition-overlay"
        >
          <BrandedLoadingState
            label="Loading…"
            variant="page"
            ariaLabel="Loading page"
            className="route-transition-overlay__inner"
          />
        </div>
      ) : null}
    </RouteTransitionContext.Provider>
  );
}
