"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useMode } from "@/components/mode/ModeProvider";
import { Button } from "@/components/ui/Button";

export function OwnSpotNotice() {
  const router = useRouter();
  const { setMode, homeFor } = useMode();

  function switchToLeaving() {
    setMode("leaver");
    router.push(homeFor("leaver"));
  }

  return (
    <div className="motion-fade-in flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border bg-surface px-4 py-3 text-sm text-muted">
      <p>You also have an active parking spot</p>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/spots/new"
          className="font-medium text-accent-hover hover:text-foreground"
        >
          View spot
        </Link>
        <Button
          type="button"
          variant="ghost"
          className="px-2 py-1 text-muted"
          onClick={switchToLeaving}
        >
          Switch to Leaving
        </Button>
      </div>
    </div>
  );
}
