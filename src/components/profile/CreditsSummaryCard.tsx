"use client";

import { useEffect, useRef, useState } from "react";

import { CoinStackIcon } from "@/components/illustrations/CoinIcon";
import { useOneShotAnimation } from "@/lib/motion/use-one-shot-animation";

type CreditsSummaryCardProps = {
  credits: number;
};

function creditNoun(n: number): string {
  return n === 1 ? "credit" : "credits";
}

function handoffNoun(n: number): string {
  return n === 1 ? "parking handoff" : "parking handoffs";
}

export function CreditsSummaryCard({ credits }: CreditsSummaryCardProps) {
  const safeCredits = Number.isFinite(credits) ? Math.max(0, Math.trunc(credits)) : 0;
  const entrance = useOneShotAnimation("profile-credits-entrance");
  const [updatePulse, setUpdatePulse] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const previousCredits = useRef(safeCredits);

  useEffect(() => {
    if (previousCredits.current === safeCredits) {
      return;
    }
    previousCredits.current = safeCredits;
    setUpdatePulse(true);
    const id = window.setTimeout(() => setUpdatePulse(false), 600);
    return () => window.clearTimeout(id);
  }, [safeCredits]);

  const balanceLabel = `${safeCredits} ${creditNoun(safeCredits)}`;

  return (
    <div
      className="flex h-full min-h-[9.5rem] flex-col gap-2"
      data-testid="credits-summary-card"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        Credits
      </p>

      <div className="mt-auto flex items-end gap-2.5">
        <span
          className={[
            "shrink-0",
            entrance ? "motion-credits-settle" : "",
            updatePulse ? "motion-credits-update" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-hidden="true"
          data-testid="credits-coin-visual"
        >
          <CoinStackIcon className="h-9 w-9" />
        </span>
        <div className="min-w-0">
          <p
            className="text-2xl font-semibold tabular-nums tracking-tight text-foreground sm:text-3xl"
            data-testid="credits-balance"
          >
            {balanceLabel}
          </p>
          <p className="mt-0.5 text-xs leading-4 text-muted">
            Enough for {safeCredits} {handoffNoun(safeCredits)}
          </p>
        </div>
      </div>

      <div className="border-t border-border/70 pt-2">
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs font-medium text-accent-hover hover:underline"
          aria-expanded={helpOpen}
          aria-controls="credits-how-it-works"
          onClick={() => setHelpOpen((open) => !open)}
        >
          How credits work
          <span
            className={["motion-chevron inline-block", helpOpen ? "is-open" : ""].join(
              " ",
            )}
            aria-hidden="true"
          >
            ▾
          </span>
        </button>
        <div
          id="credits-how-it-works"
          className={["motion-reveal-panel", helpOpen ? "is-open" : ""].join(" ")}
          hidden={!helpOpen}
        >
          <div className="motion-reveal-panel-inner">
            <p className="pt-2 text-xs leading-5 text-muted">
              Use one credit when you receive a spot. Earn one when another driver
              receives yours.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
