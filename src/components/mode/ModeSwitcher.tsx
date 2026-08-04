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

  const activeIndex = options.findIndex((option) => option.mode === mode);

  function switchTo(next: AppMode) {
    if (next === mode) {
      return;
    }
    setMode(next);
    router.push(homeFor(next));
  }

  return (
    <div
      className="relative inline-flex rounded-[var(--radius-card)] border border-border bg-accent-soft p-0.5"
      role="group"
      aria-label="Switch mode"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-[calc(var(--radius-card)-2px)] bg-accent shadow-sm transition-transform duration-[var(--motion-standard)] ease-[var(--motion-ease)]"
        style={{
          transform: `translateX(${activeIndex * 100}%)`,
        }}
      />
      {options.map((option) => {
        const active = option.mode === mode;
        return (
          <button
            key={option.mode}
            type="button"
            onClick={() => switchTo(option.mode)}
            className={[
              "relative z-[1] min-w-[4.5rem] rounded-[calc(var(--radius-card)-2px)] px-2.5 py-1 text-xs font-medium",
              "motion-interactive-press transition-[color] duration-[var(--motion-standard)]",
              active ? "text-foreground" : "text-muted hover:text-foreground",
            ].join(" ")}
            aria-pressed={active}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
