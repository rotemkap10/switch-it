import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { PWA_BACKGROUND_COLOR } from "@/lib/pwa/brand-colors";

function logoDataUri(): string {
  const bytes = readFileSync(
    join(process.cwd(), "public/branding/switch-it-logo.png"),
  );
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

/** Official Switch It logo, scaled into a square icon canvas. */
export function logoIconResponse(size: number): ImageResponse {
  const src = logoDataUri();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: PWA_BACKGROUND_COLOR,
        }}
      >
        {/* ImageResponse requires img; this is the official PNG, not a recreation. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={size} height={size} alt="" />
      </div>
    ),
    { width: size, height: size },
  );
}
