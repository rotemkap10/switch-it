"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

type AppLaunchReadyContextValue = {
  /** True once the cold-start splash has fully hidden. */
  ready: boolean;
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
  ready: true,
  reportInitialShellReady: () => {},
  requestAwaitInitialMap: () => {},
  reportInitialMapReady: () => {},
});

export function AppLaunchReadyProvider({
  ready,
  reportInitialShellReady,
  requestAwaitInitialMap,
  reportInitialMapReady,
  children,
}: {
  ready: boolean;
  reportInitialShellReady: () => void;
  requestAwaitInitialMap: () => void;
  reportInitialMapReady: () => void;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({
      ready,
      reportInitialShellReady,
      requestAwaitInitialMap,
      reportInitialMapReady,
    }),
    [
      ready,
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

/** False while the cold-start splash is still covering the app. */
export function useAppLaunchReady(): boolean {
  return useContext(AppLaunchReadyContext).ready;
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
