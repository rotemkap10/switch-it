import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CSSProperties, ReactElement } from "react";

import { PWA_BACKGROUND_COLOR } from "@/lib/pwa/brand-colors";
import { IOS_STARTUP_LOGO_CSS_PX } from "@/lib/pwa/ios-startup";

type StartupSplashMarkupProps = {
  /** Device pixel ratio used to scale the lockup to match in-app CSS sizes. */
  scale: number;
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
}: StartupSplashMarkupProps): ReactElement {
  const logoSize = Math.round(IOS_STARTUP_LOGO_CSS_PX * scale);

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
      <img src={officialLogoDataUri()} width={logoSize} height={logoSize} alt="" />
    </div>
  );
}
