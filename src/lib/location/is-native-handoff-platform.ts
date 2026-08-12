/**
 * True only inside a Capacitor iOS/Android shell.
 * Web, PWA standalone, and SSR are always false.
 */
export function isNativeHandoffPlatform(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const capacitor = (
    window as unknown as {
      Capacitor?: { isNativePlatform?: () => boolean };
    }
  ).Capacitor;
  try {
    return Boolean(capacitor?.isNativePlatform?.());
  } catch {
    return false;
  }
}
