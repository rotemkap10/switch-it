import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CSSProperties, ReactElement } from "react";

import { launchIconCssPx } from "@/lib/branding/logo-asset";
import { PWA_BACKGROUND_COLOR } from "@/lib/pwa/brand-colors";

type StartupSplashMarkupProps = {
  /** Device pixel ratio used to scale the icon to match in-app CSS sizes. */
  scale: number;
  cssWidth?: number;
  cssHeight?: number;
};

function launchIconDataUri(): string {
  const bytes = readFileSync(
    join(process.cwd(), "public/branding/switch-it-launch-icon.png"),
  );
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

/**
 * ImageResponse-safe iOS launch splash: light brand fill + square app icon only.
 */
export function StartupSplashMarkup({
  scale,
  cssWidth = 390,
  cssHeight = 844,
}: StartupSplashMarkupProps): ReactElement {
  const iconCss = launchIconCssPx(cssWidth, cssHeight);
  const iconPx = Math.round(iconCss * scale);

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
      {/* ImageResponse requires img; square app-icon tile, no wordmark. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={launchIconDataUri()} width={iconPx} height={iconPx} alt="" />
    </div>
  );
}
