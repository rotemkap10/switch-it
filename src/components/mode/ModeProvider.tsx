"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { MODE_HOME, modeStorageKey, type AppMode } from "@/lib/mode/constants";
import {
  MODE_CHANGE_EVENT,
  readMode,
  writeMode,
} from "@/lib/mode/storage";

type ModeContextValue = {
  userId: string;
  mode: AppMode | null;
  ready: boolean;
  setMode: (mode: AppMode) => void;
  homeFor: (mode: AppMode) => string;
};

const ModeContext = createContext<ModeContextValue | null>(null);

type ModeProviderProps = {
  userId: string;
  children: ReactNode;
};

export function ModeProvider({ userId, children }: ModeProviderProps) {
  const [mode, setModeState] = useState<AppMode | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    function sync() {
      setModeState(readMode(userId));
      setReady(true);
    }

    sync();

    function onStorage(event: StorageEvent) {
      if (event.key === null || event.key === modeStorageKey(userId)) {
        sync();
      }
    }

    window.addEventListener("storage", onStorage);
    window.addEventListener(MODE_CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(MODE_CHANGE_EVENT, sync);
    };
  }, [userId]);

  const setMode = useCallback(
    (next: AppMode) => {
      writeMode(userId, next);
      setModeState(next);
    },
    [userId],
  );

  const value = useMemo(
    () => ({
      userId,
      mode,
      ready,
      setMode,
      homeFor: (m: AppMode) => MODE_HOME[m],
    }),
    [userId, mode, ready, setMode],
  );

  return (
    <ModeContext.Provider value={value}>{children}</ModeContext.Provider>
  );
}

export function useMode(): ModeContextValue {
  const context = useContext(ModeContext);
  if (!context) {
    throw new Error("useMode must be used within ModeProvider");
  }
  return context;
}
