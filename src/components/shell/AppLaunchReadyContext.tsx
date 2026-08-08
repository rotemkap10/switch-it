"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

type AppLaunchReadyContextValue = {
  ready: boolean;
  reportInitialShellReady: () => void;
};

const AppLaunchReadyContext = createContext<AppLaunchReadyContextValue>({
  ready: true,
  reportInitialShellReady: () => {},
});

export function AppLaunchReadyProvider({
  ready,
  reportInitialShellReady,
  children,
}: {
  ready: boolean;
  reportInitialShellReady: () => void;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ ready, reportInitialShellReady }),
    [ready, reportInitialShellReady],
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
