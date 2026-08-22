import {
  SWITCH_IT_LAUNCH_MARK_HEIGHT,
  SWITCH_IT_LAUNCH_MARK_RATIO,
  SWITCH_IT_LAUNCH_MARK_SRC,
  SWITCH_IT_LAUNCH_MARK_WIDTH,
} from "@/lib/branding/logo-asset";
import { BOOT_SPLASH_ID } from "@/lib/pwa/boot-splash";
import { PWA_BACKGROUND_COLOR } from "@/lib/pwa/brand-colors";

/**
 * Server-rendered boot splash. Present in the initial HTML before React
 * hydrates. AppLaunchShell only hides it when the real UI is ready.
 */
export function BootSplash() {
  const markWidth = `${Math.round(SWITCH_IT_LAUNCH_MARK_RATIO * 100)}vw`;

  return (
    <div
      id={BOOT_SPLASH_ID}
      data-testid="app-launch-splash"
      role="status"
      aria-live="polite"
      aria-label="Loading Switch It"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        minHeight: "100dvh",
        margin: 0,
        padding: 0,
        background: PWA_BACKGROUND_COLOR,
        backgroundColor: PWA_BACKGROUND_COLOR,
      }}
    >
      {/* Native img: no Next/Image optimizer delay on first paint. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={SWITCH_IT_LAUNCH_MARK_SRC}
        alt=""
        width={SWITCH_IT_LAUNCH_MARK_WIDTH}
        height={SWITCH_IT_LAUNCH_MARK_HEIGHT}
        decoding="sync"
        loading="eager"
        fetchPriority="high"
        data-testid="app-boot-splash-logo"
        style={{
          display: "block",
          width: markWidth,
          height: "auto",
          aspectRatio: "1 / 1",
          maxHeight: "32dvh",
          objectFit: "contain",
          background: "transparent",
          backgroundColor: "transparent",
          border: 0,
          boxShadow: "none",
        }}
      />
    </div>
  );
}
