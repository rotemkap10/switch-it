"use client";

import { useEffect, useRef, useState } from "react";

import { CoinStackIcon } from "@/components/illustrations/CoinIcon";

type HeaderCreditsBalanceProps = {
  credits: number | null;
};

function sanitizeCredits(credits: number): number {
  return Number.isFinite(credits) ? Math.max(0, Math.trunc(credits)) : 0;
}

/**
 * Compact header credit indicator. Displays the same profiles.credits value
 * as Profile — never a second independent count.
 */
export function HeaderCreditsBalance({ credits }: HeaderCreditsBalanceProps) {
  const [updatePulse, setUpdatePulse] = useState(false);
  const previousCredits = useRef<number | null>(null);

  const ready = credits != null && Number.isFinite(credits);
  const safeCredits = ready ? sanitizeCredits(credits) : null;

  useEffect(() => {
    if (safeCredits == null) {
      return;
    }
    if (previousCredits.current == null) {
      previousCredits.current = safeCredits;
      return;
    }
    if (previousCredits.current === safeCredits) {
      return;
    }
    previousCredits.current = safeCredits;
    setUpdatePulse(true);
    const id = window.setTimeout(() => setUpdatePulse(false), 600);
    return () => window.clearTimeout(id);
  }, [safeCredits]);

  if (safeCredits == null) {
    return (
      <div
        className="inline-flex h-8 items-center gap-1.5 px-1"
        data-testid="header-credits"
        aria-busy="true"
        aria-label="Credits loading"
      >
        <span
          className="h-6 w-6 shrink-0 rounded-full bg-accent-soft"
          aria-hidden="true"
        />
        <span
          className="h-4 w-6 rounded-sm bg-accent-soft"
          aria-hidden="true"
        />
      </div>
    );
  }

  const label = `${safeCredits} ${safeCredits === 1 ? "credit" : "credits"}`;

  return (
    <div
      className={[
        "inline-flex h-8 items-center gap-1.5 px-1",
        updatePulse ? "motion-credits-update" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-testid="header-credits"
      aria-label={label}
    >
      <CoinStackIcon className="h-6 w-6 shrink-0" />
      <span
        className="text-base font-semibold leading-none tabular-nums tracking-tight text-foreground"
        data-testid="header-credits-balance"
      >
        {safeCredits}
      </span>
    </div>
  );
}
