import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "dangerOutline";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
  children: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border border-transparent bg-accent text-foreground hover:bg-accent-hover disabled:bg-accent/60",
  secondary:
    "border border-solid border-border bg-surface text-foreground hover:bg-accent-soft disabled:opacity-60",
  ghost:
    "border border-transparent bg-transparent text-foreground hover:bg-accent-soft disabled:opacity-60",
  dangerOutline:
    "border border-solid border-danger/40 bg-surface text-danger hover:bg-danger/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger/40 disabled:opacity-60",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    className = "",
    children,
    type = "button",
    loading = false,
    disabled,
    ...props
  },
  ref,
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      aria-disabled={isDisabled || undefined}
      className={[
        "inline-flex appearance-none items-center justify-center gap-2 rounded-[var(--radius-card)] px-4 py-2 text-sm font-medium",
        "motion-interactive-press transition-[color,background-color,border-color,opacity] duration-[var(--motion-fast)]",
        "disabled:cursor-not-allowed disabled:transform-none",
        variantClasses[variant],
        className,
      ].join(" ")}
      {...props}
    >
      {loading ? (
        <span className="motion-spinner shrink-0" aria-hidden="true" />
      ) : null}
      <span className={loading ? "opacity-90" : undefined}>{children}</span>
    </button>
  );
});
