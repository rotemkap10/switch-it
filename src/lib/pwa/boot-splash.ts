import { APP_LAUNCH_SPLASH_SEEN_KEY, SPLASH_FADE_MS } from "@/lib/motion/app-launch";
import { PWA_BACKGROUND_COLOR } from "@/lib/pwa/brand-colors";

export const BOOT_SPLASH_ID = "app-boot-splash";
export const APP_ROOT_ID = "app-root";

export const BOOT_SPLASH_SKIP_CLASS = "app-boot-splash-skip";
export const BOOT_SPLASH_EXITING_CLASS = "app-boot-splash-exiting";
export const BOOT_SPLASH_HIDDEN_CLASS = "app-boot-splash-hidden";

/** Inline first-paint CSS — must not wait for the globals.css bundle. */
export function bootSplashCriticalCss(
  background = PWA_BACKGROUND_COLOR,
): string {
  return [
    `html,body,#${APP_ROOT_ID},:root,#${BOOT_SPLASH_ID}{background:${background}!important;background-color:${background}!important;color-scheme: only light!important;}`,
    `@media (prefers-color-scheme:dark){html,body,#${APP_ROOT_ID},:root,#${BOOT_SPLASH_ID}{background:${background}!important;background-color:${background}!important;color-scheme: only light!important;}}`,
    `#${BOOT_SPLASH_ID}{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;width:100%;min-height:100%;min-height:100dvh;margin:0;padding:0;background:${background}!important;background-color:${background}!important;}`,
    `html.${BOOT_SPLASH_SKIP_CLASS} #${BOOT_SPLASH_ID},html.${BOOT_SPLASH_HIDDEN_CLASS} #${BOOT_SPLASH_ID}{display:none!important;}`,
    `html.${BOOT_SPLASH_EXITING_CLASS} #${BOOT_SPLASH_ID}{opacity:0;pointer-events:none;transition:opacity ${SPLASH_FADE_MS}ms cubic-bezier(0.22, 1, 0.36, 1);}`,
    `@media (prefers-reduced-motion:reduce){html.${BOOT_SPLASH_EXITING_CLASS} #${BOOT_SPLASH_ID}{transition:none;}}`,
  ].join("");
}

/** Runs before hydration so return visits never flash the boot splash. */
export function bootSplashSkipScript(): string {
  return `(function(){try{if(sessionStorage.getItem(${JSON.stringify(APP_LAUNCH_SPLASH_SEEN_KEY)})==="1"){document.documentElement.classList.add(${JSON.stringify(BOOT_SPLASH_SKIP_CLASS)});}}catch(e){}})();`;
}
