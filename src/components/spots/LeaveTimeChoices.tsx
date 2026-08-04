import {
  AVAILABLE_IN_MINUTES_OPTIONS,
  type AvailableInMinutes,
} from "@/lib/spots/constants";
import { AVAILABLE_IN_LABELS } from "@/lib/spots/labels";

type LeaveTimeChoicesProps = {
  value: AvailableInMinutes;
  onChange: (minutes: AvailableInMinutes) => void;
  disabled?: boolean;
  error?: string;
};

export function LeaveTimeChoices({
  value,
  onChange,
  disabled = false,
  error,
}: LeaveTimeChoicesProps) {
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
        className="flex flex-wrap gap-2"
      >
        {AVAILABLE_IN_MINUTES_OPTIONS.map((minutes) => {
          const selected = value === minutes;
          return (
            <button
              key={minutes}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(minutes)}
              className={[
                "rounded-full border px-4 py-2 text-sm font-medium transition-[color,background-color,border-color,transform] duration-[var(--motion-fast)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60",
                selected
                  ? "border-accent bg-accent text-foreground shadow-sm"
                  : "border-border bg-surface text-foreground hover:border-accent/50 hover:bg-accent-soft",
              ].join(" ")}
            >
              {AVAILABLE_IN_LABELS[minutes]}
            </button>
          );
        })}
      </div>
      {error ? (
        <p id="leave-time-error" className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
