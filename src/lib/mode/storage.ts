import {
  isAppMode,
  modeStorageKey,
  type AppMode,
} from "@/lib/mode/constants";

export const MODE_CHANGE_EVENT = "switch-it:mode-change";

export function readMode(userId: string): AppMode | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(modeStorageKey(userId));
    return isAppMode(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeMode(userId: string, mode: AppMode): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(modeStorageKey(userId), mode);
    window.dispatchEvent(new Event(MODE_CHANGE_EVENT));
  } catch {
    // Ignore quota / private-mode failures; UI still works for this session.
  }
}
