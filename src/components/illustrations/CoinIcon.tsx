import { ILLUSTRATION } from "@/components/illustrations/palette";

type IconProps = {
  className?: string;
  title?: string;
};

export function CoinIcon({ className = "h-5 w-5", title }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
    >
      <circle cx="12" cy="12" r="9" fill={ILLUSTRATION.coinSoft} stroke={ILLUSTRATION.navy} strokeWidth="1.5" />
      <circle cx="12" cy="12" r="6.25" fill={ILLUSTRATION.coin} stroke={ILLUSTRATION.navy} strokeWidth="1.25" />
      <path
        d="M12 8.2v7.6M9.6 10.2c.5-.7 1.4-1.1 2.4-1.1 1.5 0 2.5.8 2.5 2 0 1.1-.8 1.7-2.3 2.1l-1.2.3c-1.2.3-1.8.8-1.8 1.7 0 .9.9 1.5 2.2 1.5 1 0 1.8-.3 2.3-.9"
        fill="none"
        stroke={ILLUSTRATION.navy}
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CoinStackIcon({ className = "h-8 w-8", title }: IconProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
      data-testid="coin-stack-icon"
    >
      <ellipse cx="20" cy="30" rx="11" ry="4" fill={ILLUSTRATION.coin} stroke={ILLUSTRATION.navy} strokeWidth="1.3" />
      <ellipse cx="20" cy="25" rx="11" ry="4" fill={ILLUSTRATION.coinSoft} stroke={ILLUSTRATION.navy} strokeWidth="1.3" />
      <ellipse cx="20" cy="20" rx="11" ry="4" fill={ILLUSTRATION.coin} stroke={ILLUSTRATION.navy} strokeWidth="1.3" />
      <circle cx="20" cy="14" r="8" fill={ILLUSTRATION.coinSoft} stroke={ILLUSTRATION.navy} strokeWidth="1.4" />
      <circle cx="20" cy="14" r="5" fill={ILLUSTRATION.coin} stroke={ILLUSTRATION.navy} strokeWidth="1.1" />
    </svg>
  );
}
