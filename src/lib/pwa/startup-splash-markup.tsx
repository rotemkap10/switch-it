import type { CSSProperties, ReactElement } from "react";

import { AppIconMarkup } from "@/lib/pwa/app-icon-markup";
import { PWA_BACKGROUND_COLOR } from "@/lib/pwa/brand-colors";
import {
  IOS_STARTUP_GAP_CSS_PX,
  IOS_STARTUP_ICON_CSS_PX,
  IOS_STARTUP_WORDMARK_CSS_PX,
} from "@/lib/pwa/ios-startup";

const WORDMARK_COLOR = "#12324a";

type StartupSplashMarkupProps = {
  /** Device pixel ratio used to scale the lockup to match in-app CSS sizes. */
  scale: number;
};

/**
 * ImageResponse-safe iOS launch splash: light brand fill + app icon + wordmark.
 * Matches AppLaunchShell (centered 88px mark, 20px wordmark, 14px gap).
 */
export function StartupSplashMarkup({
  scale,
}: StartupSplashMarkupProps): ReactElement {
  const iconSize = Math.round(IOS_STARTUP_ICON_CSS_PX * scale);
  const wordmarkSize = Math.round(IOS_STARTUP_WORDMARK_CSS_PX * scale);
  const gap = Math.round(IOS_STARTUP_GAP_CSS_PX * scale);

  const root: CSSProperties = {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PWA_BACKGROUND_COLOR,
    gap,
  };

  const wordmark: CSSProperties = {
    display: "flex",
    fontSize: wordmarkSize,
    fontWeight: 600,
    letterSpacing: "0.01em",
    color: WORDMARK_COLOR,
    lineHeight: 1.1,
  };

  return (
    <div style={root}>
      <AppIconMarkup size={iconSize} />
      <div style={wordmark}>Switch It</div>
    </div>
  );
}
