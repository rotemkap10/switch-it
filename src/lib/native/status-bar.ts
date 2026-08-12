import { isNativeHandoffPlatform } from "@/lib/location/is-native-handoff-platform";

export const NATIVE_STATUS_BAR_INSET_ATTR = "data-native-status-bar";
export const NATIVE_STATUS_BAR_INSET_VALUE = "inset";

function getCapacitorPlatform(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const capacitor = (
    window as unknown as {
      Capacitor?: { getPlatform?: () => string };
    }
  ).Capacitor;
  try {
    return capacitor?.getPlatform?.() ?? null;
  } catch {
    return null;
  }
}

export function isNativeIosPlatform(): boolean {
  return isNativeHandoffPlatform() && getCapacitorPlatform() === "ios";
}

export function markNativeStatusBarInsetOwned(): void {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.setAttribute(
    NATIVE_STATUS_BAR_INSET_ATTR,
    NATIVE_STATUS_BAR_INSET_VALUE,
  );
}

export function isNativeStatusBarInsetOwned(): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  return (
    document.documentElement.getAttribute(NATIVE_STATUS_BAR_INSET_ATTR) ===
    NATIVE_STATUS_BAR_INSET_VALUE
  );
}

/**
 * Native iOS: WebView must not draw under the system status bar.
 * Uses Capacitor StatusBar overlaysWebView=false so layout starts below
 * time / signal / battery. Dark icons (Style.Light) for Switch It's light UI.
 * Android is left unchanged.
 */
export async function configureNativeStatusBar(): Promise<void> {
  if (!isNativeIosPlatform()) {
    return;
  }

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setOverlaysWebView({ overlay: false });
    // Capacitor Style.Light = dark status-bar content on a light background.
    await StatusBar.setStyle({ style: Style.Light });
    markNativeStatusBarInsetOwned();
  } catch {
    // Plugin missing / web fallback — keep CSS safe-area behavior.
  }
}
