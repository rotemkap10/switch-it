import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CSSProperties, ReactElement } from "react";

import {
  launchMarkContainSize,
  SWITCH_IT_LAUNCH_MARK_HEIGHT,
  SWITCH_IT_LAUNCH_MARK_WIDTH,
} from "@/lib/branding/logo-asset";
import { PWA_BACKGROUND_COLOR } from "@/lib/pwa/brand-colors";

type StartupSplashMarkupProps = {
  /** Device pixel ratio used to scale the icon to match in-app CSS sizes. */
  scale: number;
  cssWidth?: number;
  cssHeight?: number;
};

function launchMarkDataUri(): string {
  const bytes = readFileSync(
    join(process.cwd(), "public/branding/switch-it-launch-mark.png"),
  );
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

/**
 * ImageResponse-safe iOS launch splash: light brand fill + rounded app icon.
 */
export function StartupSplashMarkup({
  scale,
  cssWidth = 390,
  cssHeight = 844,
}: StartupSplashMarkupProps): ReactElement {
  const { width, height } = launchMarkContainSize(cssWidth, cssHeight);

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
      {/* ImageResponse requires img; rounded icon with transparent outer corners. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={launchMarkDataUri()}
        width={Math.round(width * scale)}
        height={Math.round(height * scale)}
        alt=""
      />
    </div>
  );
}

export { SWITCH_IT_LAUNCH_MARK_WIDTH, SWITCH_IT_LAUNCH_MARK_HEIGHT };
