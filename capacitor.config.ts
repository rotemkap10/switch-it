import type { CapacitorConfig } from "@capacitor/cli";

/** Keep aligned with src/lib/pwa/brand-colors.ts PWA_BACKGROUND_COLOR */
const NATIVE_SPLASH_BACKGROUND = "#dff4ff";

/**
 * Native pilot shell. Production web remains the Vercel Next.js app.
 *
 * Do NOT hard-code `server.url` here. That option is live-reload / device
 * testing only and must never silently become the production architecture.
 *
 * Dev-only remote WebView (not committed):
 *   CAPACITOR_SERVER_URL=https://switch-it-wine.vercel.app npx cap sync ios
 *
 * If CAPACITOR_SERVER_URL is unset, no remote server.url is emitted.
 *
 * Next.js Server Actions cannot be bundled into Capacitor `webDir`.
 * `native/web-placeholder` is a non-production placeholder so `cap sync`
 * has a local directory. App Store production still needs a hosted Next
 * origin or a later packaging pass.
 */

function developmentServerFromEnv():
  | { url: string; cleartext: boolean; allowNavigation: string[] }
  | undefined {
  const raw = process.env.CAPACITOR_SERVER_URL?.trim();
  if (!raw) {
    return undefined;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(
      `CAPACITOR_SERVER_URL must be a valid URL (got ${JSON.stringify(raw)})`,
    );
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("CAPACITOR_SERVER_URL must be an http(s) URL");
  }

  return {
    url: parsed.toString().replace(/\/$/, ""),
    cleartext: parsed.protocol === "http:",
    allowNavigation: [parsed.hostname],
  };
}

const developmentServer = developmentServerFromEnv();

const config: CapacitorConfig = {
  appId: "il.ac.runi.switchit",
  appName: "Switch It",
  webDir: "native/web-placeholder",
  ...(developmentServer ? { server: developmentServer } : {}),
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      launchShowDuration: 0,
      backgroundColor: NATIVE_SPLASH_BACKGROUND,
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
  },
  ios: {
    backgroundColor: NATIVE_SPLASH_BACKGROUND,
  },
  android: {
    backgroundColor: NATIVE_SPLASH_BACKGROUND,
  },
};

export default config;
