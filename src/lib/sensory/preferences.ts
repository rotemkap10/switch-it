export const SENSORY_PREFS_STORAGE_KEY = "switch-it:sensory-prefs";
export const SENSORY_PREFS_CHANGE_EVENT = "switch-it:sensory-prefs-change";

export type SensoryPreferences = {
  sounds: boolean;
  haptics: boolean;
};

export const DEFAULT_SENSORY_PREFERENCES: SensoryPreferences = {
  sounds: true,
  haptics: true,
};

function isBoolean(value: unknown): value is boolean {
  return value === true || value === false;
}

export function parseSensoryPreferences(raw: string | null): SensoryPreferences {
  if (!raw) {
    return { ...DEFAULT_SENSORY_PREFERENCES };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return { ...DEFAULT_SENSORY_PREFERENCES };
    }
    const record = parsed as Record<string, unknown>;
    return {
      sounds: isBoolean(record.sounds)
        ? record.sounds
        : DEFAULT_SENSORY_PREFERENCES.sounds,
      haptics: isBoolean(record.haptics)
        ? record.haptics
        : DEFAULT_SENSORY_PREFERENCES.haptics,
    };
  } catch {
    return { ...DEFAULT_SENSORY_PREFERENCES };
  }
}

export function readSensoryPreferences(): SensoryPreferences {
  if (typeof window === "undefined") {
    return { ...DEFAULT_SENSORY_PREFERENCES };
  }

  try {
    return parseSensoryPreferences(
      window.localStorage.getItem(SENSORY_PREFS_STORAGE_KEY),
    );
  } catch {
    return { ...DEFAULT_SENSORY_PREFERENCES };
  }
}

export function writeSensoryPreferences(
  next: Partial<SensoryPreferences>,
): SensoryPreferences {
  const merged: SensoryPreferences = {
    ...readSensoryPreferences(),
    ...next,
  };

  if (typeof window === "undefined") {
    return merged;
  }

  try {
    window.localStorage.setItem(
      SENSORY_PREFS_STORAGE_KEY,
      JSON.stringify(merged),
    );
    window.dispatchEvent(new Event(SENSORY_PREFS_CHANGE_EVENT));
  } catch {
    // Private mode / quota — keep in-memory defaults for this session.
  }

  return merged;
}
