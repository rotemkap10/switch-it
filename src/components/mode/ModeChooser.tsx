"use client";

import { useRouter } from "next/navigation";

import { useMode } from "@/components/mode/ModeProvider";
import { Card } from "@/components/ui/Card";
import type { AppMode } from "@/lib/mode/constants";

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

  function choose(mode: AppMode) {
    setMode(mode);
    router.replace(homeFor(mode));
  }

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 max-w-md text-center motion-fade-in">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent-hover">
          Switch It
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
          What would you like to do?
        </h1>
      </div>

      <div className="grid w-full max-w-2xl gap-4 sm:grid-cols-2">
        {choices.map((choice) => (
          <button
            key={choice.mode}
            type="button"
            onClick={() => choose(choice.mode)}
            className="group text-left motion-fade-in transition-[transform,box-shadow] duration-[var(--motion-fast)] hover:-translate-y-0.5 active:scale-[0.99]"
          >
            <Card className="flex h-full flex-col gap-3 bg-surface p-6 transition-colors duration-[var(--motion-fast)] group-hover:border-accent group-hover:bg-accent-soft">
              <span className="text-3xl" aria-hidden>
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
        ))}
      </div>
    </div>
  );
}
