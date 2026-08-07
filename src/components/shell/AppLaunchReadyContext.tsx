"use client";

import { createContext, useContext, type ReactNode } from "react";

const AppLaunchReadyContext = createContext(true);

export function AppLaunchReadyProvider({
  ready,
  children,
}: {
  ready: boolean;
  children: ReactNode;
}) {
  return (
    <AppLaunchReadyContext.Provider value={ready}>
      {children}
    </AppLaunchReadyContext.Provider>
  );
}

/** False while the cold-start splash is still covering the app. */
export function useAppLaunchReady(): boolean {
  return useContext(AppLaunchReadyContext);
}
