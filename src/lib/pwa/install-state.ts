export type PwaInstallCapability =
  | "unknown"
  | "standalone"
  | "chromium-installable"
  | "ios-instructions"
  | "unavailable";

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function isStandaloneDisplayMode(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const standaloneMedia =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone =
    "standalone" in window.navigator &&
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true;

  return standaloneMedia || iosStandalone;
}

function isIosTouchDevice(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  const ua = navigator.userAgent;
  const isAppleMobile =
    /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);

  return isAppleMobile;
}

export function isIosAddToHomeScreenEligible(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return isIosTouchDevice() && !isStandaloneDisplayMode();
}

export function resolvePwaInstallCapability(options: {
  standalone: boolean;
  hasDeferredPrompt: boolean;
  iosEligible: boolean;
  clientReady: boolean;
}): PwaInstallCapability {
  if (!options.clientReady) {
    return "unknown";
  }

  if (options.standalone) {
    return "standalone";
  }

  if (options.hasDeferredPrompt) {
    return "chromium-installable";
  }

  if (options.iosEligible) {
    return "ios-instructions";
  }

  return "unavailable";
}

export function shouldShowInstallMenuItem(
  capability: PwaInstallCapability,
): boolean {
  return (
    capability === "chromium-installable" ||
    capability === "ios-instructions"
  );
}
