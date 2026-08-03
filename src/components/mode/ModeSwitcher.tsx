"use client";

import { useRouter } from "next/navigation";

import { useMode } from "@/components/mode/ModeProvider";
import type { AppMode } from "@/lib/mode/constants";

const options: Array<{ mode: AppMode; label: string }> = [
  { mode: "seeker", label: "Looking" },
  { mode: "leaver", label: "Leaving" },
];

export function ModeSwitcher() {
  const router = useRouter();
  const { mode, setMode, homeFor } = useMode();

  if (!mode) {
    return null;
  }

  function switchTo(next: AppMode) {
    if (next === mode) {
      return;
    }
    setMode(next);
    router.push(homeFor(next));
  }

  return (
    <div
      className="inline-flex rounded-[var(--radius-card)] border border-border bg-accent-soft p-0.5"
      role="group"
      aria-label="Switch mode"
    >
      {options.map((option) => {
        const active = option.mode === mode;
        return (
          <button
            key={option.mode}
            type="button"
            onClick={() => switchTo(option.mode)}
            className={`rounded-[calc(var(--radius-card)-2px)] px-2.5 py-1 text-xs font-medium transition-colors duration-[var(--motion-fast)] ${
              active
                ? "bg-accent text-foreground shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
            aria-pressed={active}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
