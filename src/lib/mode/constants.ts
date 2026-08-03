export type AppMode = "seeker" | "leaver";

export const MODE_STORAGE_PREFIX = "switch-it:mode:";

export const MODE_HOME: Record<AppMode, string> = {
  seeker: "/map",
  leaver: "/spots/new",
};

export function modeStorageKey(userId: string): string {
  return `${MODE_STORAGE_PREFIX}${userId}`;
}

export function isAppMode(value: string | null | undefined): value is AppMode {
  return value === "seeker" || value === "leaver";
}
