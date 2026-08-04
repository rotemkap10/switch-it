"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useMode } from "@/components/mode/ModeProvider";

export function OwnSpotNotice() {
  const router = useRouter();
  const { setMode, homeFor } = useMode();

  function switchToLeaving() {
    setMode("leaver");
    router.push(homeFor("leaver"));
  }

  return (
    <div className="motion-fade-in inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-surface/95 px-3 py-1.5 text-xs text-muted shadow-[var(--shadow-card)] backdrop-blur-sm">
      <p className="truncate">You also have an active parking spot</p>
      <Link
        href="/spots/new"
        className="shrink-0 font-medium text-accent-hover hover:text-foreground"
      >
        View
      </Link>
      <button
        type="button"
        className="shrink-0 font-medium text-accent-hover hover:text-foreground"
        onClick={switchToLeaving}
      >
        Leave mode
      </button>
    </div>
  );
}
