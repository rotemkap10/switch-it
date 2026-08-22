"use client";

import { MAP_FLOATING_CONTROL_CLASS } from "@/lib/map/bottom-stack";

type CurrentLocationControlProps = {
  onClick: () => void;
  pending?: boolean;
  disabled?: boolean;
  /**
   * When false, pending shows a spinner but clicks still fire.
   * Find Parking uses this so an explicit Current Location click is never locked out.
   */
  disableWhenPending?: boolean;
  /** Seeker map: uses shared floating stack clearance. */
  variant?: "floating" | "embedded";
  ariaLabel?: string;
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
 * Shared compact floating map action (target icon). Used for device-location
 * recenter on Find Parking / Share a Spot, and camera recenter on live maps.
 */
export function CurrentLocationControl({
  onClick,
  pending = false,
  disabled = false,
  disableWhenPending = true,
  variant = "floating",
  ariaLabel = "Center on my location",
  className = "",
  "data-testid": testId = "current-location-control",
}: CurrentLocationControlProps) {
  const isDisabled = disabled || (pending && disableWhenPending);

  const button = (
    <button
      type="button"
      data-testid={testId}
      aria-label={ariaLabel}
      aria-busy={pending || undefined}
      disabled={isDisabled}
      onClick={onClick}
      className={[
        "flex h-11 w-11 items-center justify-center rounded-full",
        "border border-border bg-surface text-foreground",
        "hover:bg-accent hover:text-surface hover:border-accent",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:cursor-not-allowed disabled:border-dashed",
        className,
      ].join(" ")}
    >
      {pending ? (
        <span
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent"
          aria-hidden="true"
        />
      ) : (
        <LocationTargetIcon />
      )}
      <span className="sr-only">
        {pending ? "Finding your location" : ariaLabel}
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
        className="pointer-events-auto max-w-[12.5rem] rounded-full border border-border bg-surface px-3 py-1.5 text-left motion-fade-in"
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
