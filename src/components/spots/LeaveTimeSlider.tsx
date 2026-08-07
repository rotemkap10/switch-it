"use client";

import { LEAVE_DELAY_RANGE, leaveDelayValueText } from "@/lib/spots/labels";

type LeaveTimeSliderProps = {
  value: number;
  onChange: (minutes: number) => void;
  disabled?: boolean;
  error?: string;
};

/**
 * Phone-first leave-delay control: 0–10 minutes, one-minute steps.
 */
export function LeaveTimeSlider({
  value,
  onChange,
  disabled = false,
  error,
}: LeaveTimeSliderProps) {
  const clamped = Math.min(
    LEAVE_DELAY_RANGE.max,
    Math.max(LEAVE_DELAY_RANGE.min, Math.round(value)),
  );
  const valueText = leaveDelayValueText(clamped);
  const fillPercent =
    ((clamped - LEAVE_DELAY_RANGE.min) /
      (LEAVE_DELAY_RANGE.max - LEAVE_DELAY_RANGE.min)) *
    100;

  return (
    <div className="flex flex-col gap-3" data-testid="leave-time-slider">
      <div className="flex items-end justify-between gap-3">
        <p
          id="leave-time-label"
          className="text-sm font-semibold text-foreground"
        >
          When will you leave?
        </p>
        <p
          className="text-lg font-semibold tabular-nums text-foreground"
          data-testid="leave-time-value"
          aria-live="polite"
        >
          {valueText}
        </p>
      </div>

      <div className="leave-time-slider-track">
        <input
          type="range"
          id="leave-time-range"
          name="available_in_minutes_control"
          min={LEAVE_DELAY_RANGE.min}
          max={LEAVE_DELAY_RANGE.max}
          step={LEAVE_DELAY_RANGE.step}
          value={clamped}
          disabled={disabled}
          aria-labelledby="leave-time-label"
          aria-valuemin={LEAVE_DELAY_RANGE.min}
          aria-valuemax={LEAVE_DELAY_RANGE.max}
          aria-valuenow={clamped}
          aria-valuetext={valueText}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? "leave-time-error" : undefined}
          className="leave-time-range"
          data-testid="leave-time-range"
          style={{ ["--leave-fill" as string]: `${fillPercent}%` }}
          onChange={(event) => {
            onChange(Number(event.target.value));
          }}
        />
      </div>

      <div className="flex justify-between text-xs text-muted">
        <span>Now</span>
        <span>10 min</span>
      </div>

      {error ? (
        <p id="leave-time-error" className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
