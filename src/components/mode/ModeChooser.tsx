"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useMode } from "@/components/mode/ModeProvider";
import { Card } from "@/components/ui/Card";
import type { AppMode } from "@/lib/mode/constants";

const MODE_SELECT_FEEDBACK_MS = 180;

const choices: Array<{
  mode: AppMode;
  emoji: string;
  title: string;
  description: string;
}> = [
  {
    mode: "seeker",
    emoji: "🚗",
    title: "Find parking",
    description: "I’m looking for a parking spot nearby.",
  },
  {
    mode: "leaver",
    emoji: "🅿️",
    title: "Share my parking spot",
    description: "I’m leaving and can hand off my spot.",
  },
];

export function ModeChooser() {
  const router = useRouter();
  const { setMode, homeFor } = useMode();
  const [selecting, setSelecting] = useState<AppMode | null>(null);

  function choose(mode: AppMode) {
    if (selecting) {
      return;
    }

    setSelecting(mode);
    window.setTimeout(() => {
      setMode(mode);
      router.replace(homeFor(mode));
    }, MODE_SELECT_FEEDBACK_MS);
  }

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 max-w-md text-center motion-fade-in motion-stagger-1">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent-hover">
          Switch It
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
          What would you like to do?
        </h1>
      </div>

      <div className="grid w-full max-w-2xl gap-4 sm:grid-cols-2">
        {choices.map((choice, index) => {
          const selected = selecting === choice.mode;
          return (
            <button
              key={choice.mode}
              type="button"
              onClick={() => choose(choice.mode)}
              disabled={selecting !== null}
              className={[
                "group text-left motion-fade-slide-up motion-interactive-press",
                index === 0 ? "motion-stagger-2" : "motion-stagger-3",
                selected ? "motion-mode-selected" : "",
              ].join(" ")}
            >
              <Card
                interactive
                className={[
                  "flex h-full flex-col gap-3 p-6 transition-[border-color,background-color] duration-[var(--motion-fast)]",
                  selected
                    ? "border-accent bg-accent-soft"
                    : "group-hover:border-accent group-hover:bg-accent-soft",
                ].join(" ")}
              >
                <span
                  className="inline-block text-3xl transition-transform duration-[var(--motion-fast)] group-hover:scale-105"
                  aria-hidden
                >
                  {choice.emoji}
                </span>
                <span className="block text-xl font-semibold text-foreground">
                  {choice.title}
                </span>
                <span className="block text-sm leading-6 text-muted">
                  {choice.description}
                </span>
              </Card>
            </button>
          );
        })}
      </div>
    </div>
  );
}
