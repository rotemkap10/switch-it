type SwitchItLogoMarkProps = {
  size?: number;
  className?: string;
  /** Include rounded brand tile behind the pin. */
  withTile?: boolean;
};

/**
 * Shared Switch It mark — parking pin with subtle switch cues.
 */
export function SwitchItLogoMark({
  size = 72,
  className = "",
  withTile = true,
}: SwitchItLogoMarkProps) {
  const tileRadius = Math.round(size * 0.22);
  const iconSize = Math.round(size * (withTile ? 0.58 : 0.72));

  return (
    <div
      className={["switch-it-logo-mark", className].filter(Boolean).join(" ")}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {withTile ? (
        <div
          className="switch-it-logo-mark__tile"
          style={{ borderRadius: tileRadius }}
        />
      ) : null}
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="switch-it-logo-mark__icon"
      >
        <path
          d="M32 58c0 0 11-11.2 11-20.8a11 11 0 1 0-22 0C21 46.8 32 58 32 58Z"
          fill="#ffffff"
        />
        <circle cx="32" cy="24" r="6" fill="#55bff3" />
        <path
          d="M18 14h6l-3 6-3-6Zm22 0h6l-3 6-3-6Z"
          fill="#ffffff"
          opacity="0.95"
        />
        <path
          d="M21 12c2-2 5-2 7 0M43 12c-2-2-5-2-7 0"
          stroke="#ffffff"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
