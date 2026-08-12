"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

/** Authoritative cold-launch cover state. */
export type AppLaunchPhase = "covering" | "releasing" | "released";

type AppLaunchReadyContextValue = {
  /** COVERING → RELEASING → RELEASED */
  phase: AppLaunchPhase;
  /** True only after RELEASED (splash fully gone). */
  ready: boolean;
  /** True while splash must own the UI (covering or releasing). */
  isCovering: boolean;
  reportInitialShellReady: () => void;
  /**
   * Cold launch to /map: keep splash until the first usable map frame.
   * No-op after splash exit has started.
   */
  requestAwaitInitialMap: () => void;
  /** First credible map frame (or map terminal error UI) during cold launch. */
  reportInitialMapReady: () => void;
};

const AppLaunchReadyContext = createContext<AppLaunchReadyContextValue>({
  phase: "released",
  ready: true,
  isCovering: false,
  reportInitialShellReady: () => {},
  requestAwaitInitialMap: () => {},
  reportInitialMapReady: () => {},
});

export function AppLaunchReadyProvider({
  phase,
  reportInitialShellReady,
  requestAwaitInitialMap,
  reportInitialMapReady,
  children,
}: {
  phase: AppLaunchPhase;
  reportInitialShellReady: () => void;
  requestAwaitInitialMap: () => void;
  reportInitialMapReady: () => void;
  children: ReactNode;
}) {
  const ready = phase === "released";
  const isCovering = phase !== "released";
  const value = useMemo(
    () => ({
      phase,
      ready,
      isCovering,
      reportInitialShellReady,
      requestAwaitInitialMap,
      reportInitialMapReady,
    }),
    [
      phase,
      ready,
      isCovering,
      reportInitialShellReady,
      requestAwaitInitialMap,
      reportInitialMapReady,
    ],
  );

  return (
    <AppLaunchReadyContext.Provider value={value}>
      {children}
    </AppLaunchReadyContext.Provider>
  );
}

/** False while the cold-start splash is still covering or releasing. */
export function useAppLaunchReady(): boolean {
  return useContext(AppLaunchReadyContext).ready;
}

/** True while branded splash must remain the sole loading surface. */
export function useAppLaunchCovering(): boolean {
  return useContext(AppLaunchReadyContext).isCovering;
}

export function useAppLaunchPhase(): AppLaunchPhase {
  return useContext(AppLaunchReadyContext).phase;
}

/** Call once when the first real route shell has mounted. */
export function useReportInitialShellReady(): () => void {
  return useContext(AppLaunchReadyContext).reportInitialShellReady;
}

/** Cold-launch /map: defer splash exit until the map reports ready. */
export function useRequestAwaitInitialMap(): () => void {
  return useContext(AppLaunchReadyContext).requestAwaitInitialMap;
}

/** Cold-launch /map: first usable map frame (or map error UI). */
export function useReportInitialMapReady(): () => void {
  return useContext(AppLaunchReadyContext).reportInitialMapReady;
}
