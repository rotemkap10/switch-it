type HelpInfoIconProps = {
  className?: string;
};

/** Compact help/info mark used on Profile and Help & Safety. */
export function HelpInfoIcon({ className = "h-5 w-5" }: HelpInfoIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      data-testid="help-info-icon"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M12 10.75V17"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="12" cy="7.5" r="1.15" fill="currentColor" />
    </svg>
  );
}

export function HelpRowChevronIcon({ className = "h-4 w-4" }: HelpInfoIconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M6 3.5 11 8 6 12.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
