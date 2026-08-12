"use client";

import { useCallback, useEffect, useState } from "react";

import {
  readSensoryPreferences,
  SENSORY_PREFS_CHANGE_EVENT,
  writeSensoryPreferences,
  type SensoryPreferences,
} from "@/lib/sensory/preferences";

function PreferenceSwitch({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onCheckedChange(!checked)}
        className={[
          "relative h-7 w-11 shrink-0 rounded-full border transition-colors",
          checked
            ? "border-accent bg-accent"
            : "border-border bg-surface",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-0.5 h-5 w-5 rounded-full bg-foreground shadow-sm transition-transform",
            checked ? "left-5" : "left-0.5",
          ].join(" ")}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}

export function SensoryPreferences() {
  const [prefs, setPrefs] = useState<SensoryPreferences>(() =>
    readSensoryPreferences(),
  );

  useEffect(() => {
    const sync = () => setPrefs(readSensoryPreferences());
    window.addEventListener(SENSORY_PREFS_CHANGE_EVENT, sync);
    return () => window.removeEventListener(SENSORY_PREFS_CHANGE_EVENT, sync);
  }, []);

  const update = useCallback((patch: Partial<SensoryPreferences>) => {
    setPrefs(writeSensoryPreferences(patch));
  }, []);

  return (
    <div className="flex flex-col gap-4" data-testid="sensory-preferences">
      <PreferenceSwitch
        label="Sounds"
        description="Short cues for publish, claim, and handoff"
        checked={prefs.sounds}
        onCheckedChange={(sounds) => update({ sounds })}
      />
      <PreferenceSwitch
        label="Haptics"
        description="Light vibration on important handoff events"
        checked={prefs.haptics}
        onCheckedChange={(haptics) => update({ haptics })}
      />
    </div>
  );
}
