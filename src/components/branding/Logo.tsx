import Image from "next/image";

export const SWITCH_IT_LOGO_SRC = "/branding/switch-it-logo.png";
export const SWITCH_IT_LOGO_WIDTH = 1254;
export const SWITCH_IT_LOGO_HEIGHT = 1254;

export type LogoVariant = "hero" | "auth" | "nav" | "splash";

const VARIANT_CLASS: Record<LogoVariant, string> = {
  hero: "switch-it-logo switch-it-logo--hero",
  auth: "switch-it-logo switch-it-logo--auth",
  nav: "switch-it-logo switch-it-logo--nav",
  splash: "switch-it-logo switch-it-logo--splash",
};

const VARIANT_SIZES: Record<LogoVariant, string> = {
  hero: "(min-width: 1024px) 28rem, (min-width: 640px) 22rem, 16.5rem",
  auth: "(min-width: 640px) 16rem, 13.5rem",
  nav: "8rem",
  splash: "14rem",
};

type LogoProps = {
  variant?: LogoVariant;
  className?: string;
  /** Parent already names the control; keep the image decorative. */
  decorative?: boolean;
  priority?: boolean;
};

export function Logo({
  variant = "auth",
  className = "",
  decorative = false,
  priority,
}: LogoProps) {
  const eager =
    priority ??
    (variant === "hero" || variant === "auth" || variant === "splash");

  return (
    <Image
      src={SWITCH_IT_LOGO_SRC}
      alt={decorative ? "" : "Switch It"}
      width={SWITCH_IT_LOGO_WIDTH}
      height={SWITCH_IT_LOGO_HEIGHT}
      priority={eager}
      sizes={VARIANT_SIZES[variant]}
      className={[VARIANT_CLASS[variant], className].filter(Boolean).join(" ")}
    />
  );
}
