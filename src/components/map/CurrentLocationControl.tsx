"use client";

import { MAP_FLOATING_CONTROL_CLASS } from "@/lib/map/bottom-stack";

type CurrentLocationControlProps = {
  onClick: () => void;
  pending?: boolean;
  disabled?: boolean;
  /** Seeker map: uses shared floating stack clearance. */
  variant?: "floating" | "embedded";
  className?: string;
  "data-testid"?: string;
};

function LocationTargetIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="7"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <circle cx="12" cy="12" r="2.25" fill="currentColor" />
      <path
        d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Shared “center on my device location” map control for primary Switch It maps.
 */
export function CurrentLocationControl({
  onClick,
  pending = false,
  disabled = false,
  variant = "floating",
  className = "",
  "data-testid": testId = "current-location-control",
}: CurrentLocationControlProps) {
  const isDisabled = disabled || pending;

  const button = (
    <button
      type="button"
      data-testid={testId}
      aria-label="Center on my location"
      aria-busy={pending || undefined}
      disabled={isDisabled}
      onClick={onClick}
      className={[
        "flex h-10 w-10 items-center justify-center rounded-full",
        "border border-border bg-surface text-foreground shadow-[var(--shadow-card)]",
        "transition-opacity hover:bg-surface/95",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      ].join(" ")}
    >
      {pending ? (
        <span
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-foreground"
          aria-hidden="true"
        />
      ) : (
        <LocationTargetIcon />
      )}
      <span className="sr-only">
        {pending ? "Finding your location" : "Center on my location"}
      </span>
    </button>
  );

  if (variant === "embedded") {
    return (
      <div className="pointer-events-auto absolute right-2 bottom-12 z-[3]">
        {button}
      </div>
    );
  }

  return (
    <div className={MAP_FLOATING_CONTROL_CLASS} data-testid={`${testId}-host`}>
      {button}
    </div>
  );
}

/** Quiet inline feedback after a recenter geolocation failure. */
export function CurrentLocationUnavailableNotice({
  onDismiss,
}: {
  onDismiss?: () => void;
}) {
  return (
    <div
      className={`${MAP_FLOATING_CONTROL_CLASS} z-[4]`}
      role="status"
      aria-live="polite"
    >
      <div
        data-testid="current-location-unavailable-notice"
        className="pointer-events-auto max-w-[12.5rem] rounded-full border border-border bg-surface/95 px-3 py-1.5 text-left shadow-[var(--shadow-card)] motion-fade-in"
      >
        <p className="text-xs font-medium text-foreground">
          Current location is unavailable.
        </p>
        <p className="text-[0.65rem] leading-4 text-muted">
          You can still move the map manually.
        </p>
        {onDismiss ? (
          <button
            type="button"
            className="mt-1 text-[0.65rem] font-medium text-accent underline-offset-2 hover:underline"
            onClick={onDismiss}
          >
            Dismiss
          </button>
        ) : null}
      </div>
    </div>
  );
}
