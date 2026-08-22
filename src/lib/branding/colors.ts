/**
 * Switch It strict two-color brand palette.
 * All authored UI must use only these values (via CSS tokens or imports).
 */
export const SIGNAL_BLUE = "#0057FF";
export const PORCELAIN = "#F8F7F4";

/** CSS custom properties — keep in sync with globals.css :root */
export const BRAND_CSS_VARS = {
  brand: SIGNAL_BLUE,
  background: PORCELAIN,
  surface: PORCELAIN,
  text: SIGNAL_BLUE,
  border: SIGNAL_BLUE,
} as const;
