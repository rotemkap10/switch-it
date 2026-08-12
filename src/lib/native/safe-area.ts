import { isNativeStatusBarInsetOwned } from "@/lib/native/status-bar";

export type SafeAreaInsets = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

const ZERO_INSETS: SafeAreaInsets = {
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
};

/** Ensures iOS can expose non-zero safe-area env vars (requires a single viewport meta). */
export function ensureViewportFitCover(): void {
  if (typeof document === "undefined") {
    return;
  }

  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) {
    return;
  }

  const content = meta.getAttribute("content") ?? "";
  if (content.includes("viewport-fit=cover")) {
    return;
  }

  meta.setAttribute(
    "content",
    content
      ? `${content}, viewport-fit=cover`
      : "width=device-width, initial-scale=1, viewport-fit=cover",
  );
}

/** Measure safe-area insets via env()/constant() on a probe element. */
export function measureSafeAreaInsets(): SafeAreaInsets {
  if (typeof document === "undefined") {
    return ZERO_INSETS;
  }

  const probe = document.createElement("div");
  probe.style.cssText = [
    "position:fixed",
    "top:0",
    "left:0",
    "visibility:hidden",
    "pointer-events:none",
    "padding-top:constant(safe-area-inset-top)",
    "padding-top:env(safe-area-inset-top,0px)",
    "padding-bottom:constant(safe-area-inset-bottom)",
    "padding-bottom:env(safe-area-inset-bottom,0px)",
    "padding-left:constant(safe-area-inset-left)",
    "padding-left:env(safe-area-inset-left,0px)",
    "padding-right:constant(safe-area-inset-right)",
    "padding-right:env(safe-area-inset-right,0px)",
  ].join(";");

  document.documentElement.appendChild(probe);
  const style = getComputedStyle(probe);
  const insets: SafeAreaInsets = {
    top: parseFloat(style.paddingTop) || 0,
    bottom: parseFloat(style.paddingBottom) || 0,
    left: parseFloat(style.paddingLeft) || 0,
    right: parseFloat(style.paddingRight) || 0,
  };
  document.documentElement.removeChild(probe);
  return insets;
}

/** Publish safe-area tokens on `<html>` for all shell utilities to consume. */
export function syncSafeAreaInsetCssVars(): SafeAreaInsets {
  if (typeof document === "undefined") {
    return ZERO_INSETS;
  }

  ensureViewportFitCover();
  const insets = measureSafeAreaInsets();
  const root = document.documentElement;

  // Native iOS non-overlay StatusBar already insets the WebView below the
  // system bar. Zero --app-safe-top so CSS does not add a second gap.
  const top =
    isNativeStatusBarInsetOwned() ? 0 : insets.top;

  root.style.setProperty("--app-safe-top", `${top}px`);
  root.style.setProperty("--app-safe-bottom", `${insets.bottom}px`);
  root.style.setProperty("--app-safe-left", `${insets.left}px`);
  root.style.setProperty("--app-safe-right", `${insets.right}px`);
  return {
    top,
    bottom: insets.bottom,
    left: insets.left,
    right: insets.right,
  };
}

/**
 * Runs before React hydration so the first authenticated header paint respects
 * the iOS status bar / Dynamic Island inset.
 */
export function safeAreaBootstrapScript(): string {
  return `(function(){try{var m=document.querySelector('meta[name="viewport"]');if(m){var c=m.getAttribute("content")||"";if(c.indexOf("viewport-fit=cover")===-1){m.setAttribute("content",c?c+", viewport-fit=cover":"width=device-width, initial-scale=1, viewport-fit=cover");}}var p=document.createElement("div");p.style.cssText="position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;padding-top:constant(safe-area-inset-top);padding-top:env(safe-area-inset-top,0px);padding-bottom:constant(safe-area-inset-bottom);padding-bottom:env(safe-area-inset-bottom,0px);padding-left:constant(safe-area-inset-left);padding-left:env(safe-area-inset-left,0px);padding-right:constant(safe-area-inset-right);padding-right:env(safe-area-inset-right,0px)";document.documentElement.appendChild(p);var s=getComputedStyle(p);document.documentElement.style.setProperty("--app-safe-top",(parseFloat(s.paddingTop)||0)+"px");document.documentElement.style.setProperty("--app-safe-bottom",(parseFloat(s.paddingBottom)||0)+"px");document.documentElement.style.setProperty("--app-safe-left",(parseFloat(s.paddingLeft)||0)+"px");document.documentElement.style.setProperty("--app-safe-right",(parseFloat(s.paddingRight)||0)+"px");document.documentElement.removeChild(p);}catch(e){}})();`;
}
