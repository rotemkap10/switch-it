export type AppMode = "seeker" | "leaver";

export const MODE_STORAGE_PREFIX = "switch-it:mode:";

export const MODE_HOME: Record<AppMode, string> = {
  seeker: "/map",
  leaver: "/spots/new",
};

/** Primary navigation labels — keep these exact strings in the mode switch. */
export const MODE_LABELS: Record<AppMode, string> = {
  seeker: "Find parking",
  leaver: "Share a spot",
};

export const MODE_OPTIONS: ReadonlyArray<{ mode: AppMode; href: string; label: string }> =
  [
    { mode: "seeker", href: MODE_HOME.seeker, label: MODE_LABELS.seeker },
    { mode: "leaver", href: MODE_HOME.leaver, label: MODE_LABELS.leaver },
  ];

export function modeStorageKey(userId: string): string {
  return `${MODE_STORAGE_PREFIX}${userId}`;
}

export function isAppMode(value: string | null | undefined): value is AppMode {
  return value === "seeker" || value === "leaver";
}

/** Route is the source of truth for the selected mode. */
export function modeFromPathname(pathname: string): AppMode | null {
  if (pathname === "/map" || pathname.startsWith("/map/")) {
    return "seeker";
  }
  if (pathname === "/spots/new" || pathname.startsWith("/spots/")) {
    return "leaver";
  }
  return null;
}
