import Image from "next/image";

import {
  SWITCH_IT_LAUNCH_MARK_HEIGHT,
  SWITCH_IT_LAUNCH_MARK_SRC,
  SWITCH_IT_LAUNCH_MARK_WIDTH,
  SWITCH_IT_LOGO_HEIGHT,
  SWITCH_IT_LOGO_SRC,
  SWITCH_IT_LOGO_WIDTH,
} from "@/lib/branding/logo-asset";

export {
  SWITCH_IT_LOGO_HEIGHT,
  SWITCH_IT_LOGO_SRC,
  SWITCH_IT_LOGO_WIDTH,
} from "@/lib/branding/logo-asset";

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
  splash: "28vw",
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

  const src = variant === "splash" ? SWITCH_IT_LAUNCH_MARK_SRC : SWITCH_IT_LOGO_SRC;
  const width =
    variant === "splash" ? SWITCH_IT_LAUNCH_MARK_WIDTH : SWITCH_IT_LOGO_WIDTH;
  const height =
    variant === "splash" ? SWITCH_IT_LAUNCH_MARK_HEIGHT : SWITCH_IT_LOGO_HEIGHT;

  return (
    <Image
      src={src}
      alt={decorative ? "" : "Switch It"}
      width={width}
      height={height}
      priority={eager}
      /* Brand PNGs must load directly — never via /_next/image (stale optimizer/CDN cache). */
      unoptimized
      sizes={VARIANT_SIZES[variant]}
      className={[VARIANT_CLASS[variant], className].filter(Boolean).join(" ")}
    />
  );
}
