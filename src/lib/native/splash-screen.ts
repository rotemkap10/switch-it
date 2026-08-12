import { isNativeHandoffPlatform } from "@/lib/location/is-native-handoff-platform";

let hidePromise: Promise<void> | null = null;

/**
 * Dismiss the Capacitor native splash overlay. Safe to call from web/PWA
 * (no-op). Idempotent within a single cold launch.
 */
export async function hideNativeSplashScreen(): Promise<void> {
  if (!isNativeHandoffPlatform()) {
    return;
  }

  if (hidePromise) {
    return hidePromise;
  }

  hidePromise = (async () => {
    try {
      const { SplashScreen } = await import("@capacitor/splash-screen");
      await SplashScreen.hide();
    } catch {
      // Splash is optional — never block app startup.
    }
  })();

  return hidePromise;
}

/** Test helper — reset idempotent hide state between cases. */
export function resetNativeSplashHideForTests(): void {
  hidePromise = null;
}
