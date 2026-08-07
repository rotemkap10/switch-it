import { SwitchItLogoMark } from "@/components/brand/SwitchItLogoMark";

type AuthBrandProps = {
  className?: string;
  /** Mark size in px; wordmark scales via CSS. */
  markSize?: number;
};

/**
 * Entry/auth brand lockup: Switch It app icon + wordmark.
 * Reuses the same vector mark as PWA icons (`SwitchItLogoMark` / `AppIconMarkup`).
 */
export function AuthBrand({ className = "", markSize = 40 }: AuthBrandProps) {
  return (
    <div
      className={["auth-brand", className].filter(Boolean).join(" ")}
      data-testid="auth-brand"
    >
      <SwitchItLogoMark size={markSize} className="auth-brand__mark" />
      <span className="auth-brand__wordmark">Switch It</span>
    </div>
  );
}
