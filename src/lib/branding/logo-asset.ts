export const SWITCH_IT_LOGO_SRC = "/branding/switch-it-logo.png";

/** Intrinsic size of the transparent lockup (not the old square canvas). */
export const SWITCH_IT_LOGO_WIDTH = 1106;
export const SWITCH_IT_LOGO_HEIGHT = 342;

export function containedLogoSize(
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  const aspect = SWITCH_IT_LOGO_WIDTH / SWITCH_IT_LOGO_HEIGHT;
  let width = Math.max(1, Math.round(maxWidth));
  let height = Math.max(1, Math.round(maxWidth / aspect));
  if (height > maxHeight) {
    height = Math.max(1, Math.round(maxHeight));
    width = Math.max(1, Math.round(maxHeight * aspect));
  }
  return { width, height };
}
