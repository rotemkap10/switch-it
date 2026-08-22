import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "dangerOutline";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
  children: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border border-solid border-accent bg-accent text-surface hover:bg-surface hover:text-accent disabled:border-accent disabled:bg-surface disabled:text-accent disabled:border-dashed",
  secondary:
    "border border-solid border-border bg-surface text-foreground hover:bg-accent hover:text-surface hover:border-accent disabled:border-dashed",
  ghost:
    "border border-transparent bg-transparent text-foreground hover:border-border hover:bg-surface disabled:border-dashed",
  dangerOutline:
    "border-2 border-solid border-accent bg-surface text-accent hover:bg-accent hover:text-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:border-dashed",
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
      <span className={loading ? "font-semibold" : undefined}>{children}</span>
    </button>
  );
});
