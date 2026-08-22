import { afterNextPaint } from "@/lib/motion/app-launch";
import { BOOT_SPLASH_ID } from "@/lib/pwa/boot-splash";
import { logStartup } from "@/lib/native/startup-log";

const BOOT_SPLASH_PAINT_TIMEOUT_MS = 2_500;

function bootSplashLogo(): HTMLImageElement | null {
  if (typeof document === "undefined") {
    return null;
  }
  const root = document.getElementById(BOOT_SPLASH_ID);
  if (!root) {
    return null;
  }
  return root.querySelector("img");
}

function logoLooksPainted(img: HTMLImageElement | null): boolean {
  if (!img) {
    // No logo node — treat as ready so we never block hide forever.
    return true;
  }
  return img.complete && img.naturalWidth > 0;
}

function waitFrames(): Promise<void> {
  return new Promise((resolve) => {
    afterNextPaint(() => resolve());
  });
}

/**
 * Resolves only after the SSR `#app-boot-splash` logo is decoded/painted
 * (or a short timeout). Call before native SplashScreen.hide() so the next
 * visible frame already contains the Switch It logo on Porcelain.
 */
export async function waitForWebBootSplashPainted(): Promise<void> {
  if (typeof document === "undefined") {
    return;
  }

  const img = bootSplashLogo();
  logStartup("web boot splash DOM ready", {
    hasSplash: Boolean(document.getElementById(BOOT_SPLASH_ID)),
    hasLogo: Boolean(img),
    logoComplete: img?.complete ?? null,
    naturalWidth: img?.naturalWidth ?? null,
  });

  if (!logoLooksPainted(img) && img) {
    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) {
          return;
        }
        settled = true;
        img.removeEventListener("load", finish);
        img.removeEventListener("error", finish);
        window.clearTimeout(timeoutId);
        resolve();
      };
      const timeoutId = window.setTimeout(finish, BOOT_SPLASH_PAINT_TIMEOUT_MS);
      img.addEventListener("load", finish);
      img.addEventListener("error", finish);
      // Race: may have finished between the complete check and listeners.
      if (logoLooksPainted(img)) {
        finish();
      }
    });
  }

  await waitFrames();
  logStartup("web boot splash painted", {
    logoComplete: bootSplashLogo()?.complete ?? null,
    naturalWidth: bootSplashLogo()?.naturalWidth ?? null,
  });
}
