import type { CSSProperties } from "react";

type AppIconMarkupProps = {
  size: number;
  maskable?: boolean;
};

/**
 * Vector-style Switch It icon for ImageResponse routes.
 * Rounded brand background + parking pin + subtle switch arrows.
 */
export function AppIconMarkup({
  size,
  maskable = false,
}: AppIconMarkupProps) {
  const radius = maskable ? 0 : Math.round(size * 0.22);
  const pinScale = maskable ? 0.52 : 0.58;

  const container: CSSProperties = {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#55bff3",
    borderRadius: radius,
  };

  const svgSize = Math.round(size * pinScale);

  return (
    <div style={container}>
      <svg
        width={svgSize}
        height={svgSize}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
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
