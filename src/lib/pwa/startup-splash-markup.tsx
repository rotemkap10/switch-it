import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CSSProperties, ReactElement } from "react";

import { containedLogoSize } from "@/lib/branding/logo-asset";
import { PWA_BACKGROUND_COLOR } from "@/lib/pwa/brand-colors";
import { iosStartupLogoCssPx } from "@/lib/pwa/ios-startup";

type StartupSplashMarkupProps = {
  /** Device pixel ratio used to scale the lockup to match in-app CSS sizes. */
  scale: number;
  cssWidth?: number;
  cssHeight?: number;
};

function officialLogoDataUri(): string {
  const bytes = readFileSync(
    join(process.cwd(), "public/branding/switch-it-logo.png"),
  );
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

/**
 * ImageResponse-safe iOS launch splash: light brand fill + official logo.
 * Matches AppLaunchShell (centered logo, no extra wordmark).
 */
export function StartupSplashMarkup({
  scale,
  cssWidth = 390,
  cssHeight = 844,
}: StartupSplashMarkupProps): ReactElement {
  const cssLogoWidth = iosStartupLogoCssPx(cssWidth, cssHeight);
  const { width, height } = containedLogoSize(
    Math.round(cssLogoWidth * scale),
    Math.round(cssHeight * scale * 0.45),
  );

  const root: CSSProperties = {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PWA_BACKGROUND_COLOR,
  };

  return (
    <div style={root}>
      {/* ImageResponse requires img; official PNG is not redesigned. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={officialLogoDataUri()} width={width} height={height} alt="" />
    </div>
  );
}
