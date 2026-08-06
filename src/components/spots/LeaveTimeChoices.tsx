"use client";

import { useState } from "react";

import { type AvailableInMinutes } from "@/lib/spots/constants";
import { AVAILABLE_IN_LABELS } from "@/lib/spots/labels";

const PRIMARY_MINUTES: AvailableInMinutes[] = [0, 5, 10, 15, 20];
const MORE_MINUTES: AvailableInMinutes[] = [25, 30];

type LeaveTimeChoicesProps = {
  value: AvailableInMinutes;
  onChange: (minutes: AvailableInMinutes) => void;
  disabled?: boolean;
  error?: string;
};

function TimeChip({
  minutes,
  selected,
  disabled,
  onSelect,
}: {
  minutes: AvailableInMinutes;
  selected: boolean;
  disabled: boolean;
  onSelect: (minutes: AvailableInMinutes) => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={() => onSelect(minutes)}
      className={[
        "publisher-leave-time-chip motion-interactive-press",
        "transition-[color,background-color,border-color,transform,box-shadow] duration-[var(--motion-fast)]",
        "disabled:cursor-not-allowed disabled:opacity-60 disabled:transform-none",
        selected
          ? "motion-chip-selected border-accent bg-accent text-foreground shadow-sm"
          : "border-border bg-surface text-foreground hover:border-accent/50 hover:bg-accent-soft",
      ].join(" ")}
    >
      {AVAILABLE_IN_LABELS[minutes]}
    </button>
  );
}

export function LeaveTimeChoices({
  value,
  onChange,
  disabled = false,
  error,
}: LeaveTimeChoicesProps) {
  const needsMore = MORE_MINUTES.includes(value);
  const [manuallyExpanded, setManuallyExpanded] = useState(false);
  const showMore = manuallyExpanded || needsMore;

  return (
    <div className="flex flex-col gap-2">
      <p id="leave-time-label" className="text-sm font-semibold text-foreground">
        When are you leaving?
      </p>
      <div
        role="radiogroup"
        aria-labelledby="leave-time-label"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "leave-time-error" : undefined}
        className="publisher-leave-time-grid"
        data-testid="leave-time-grid"
      >
        {PRIMARY_MINUTES.map((minutes) => (
          <TimeChip
            key={minutes}
            minutes={minutes}
            selected={value === minutes}
            disabled={disabled}
            onSelect={onChange}
          />
        ))}
        {showMore
          ? MORE_MINUTES.map((minutes) => (
              <TimeChip
                key={minutes}
                minutes={minutes}
                selected={value === minutes}
                disabled={disabled}
                onSelect={onChange}
              />
            ))
          : null}
        <button
          type="button"
          aria-expanded={showMore}
          disabled={disabled}
          onClick={() => {
            if (showMore) {
              if (!needsMore) {
                setManuallyExpanded(false);
              }
              return;
            }
            setManuallyExpanded(true);
          }}
          className={[
            "publisher-leave-time-chip motion-interactive-press",
            "transition-[color,background-color,border-color] duration-[var(--motion-fast)]",
            "disabled:cursor-not-allowed disabled:opacity-60",
            showMore
              ? "border-accent bg-accent-soft text-foreground"
              : "border-border bg-surface text-foreground hover:border-accent/50 hover:bg-accent-soft",
          ].join(" ")}
        >
          More
        </button>
      </div>

      {error ? (
        <p id="leave-time-error" className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
