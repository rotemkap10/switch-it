import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  children: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-foreground hover:bg-accent-hover disabled:bg-accent/60",
  secondary:
    "border border-border bg-surface text-foreground hover:bg-accent-soft disabled:opacity-60",
  ghost:
    "bg-transparent text-foreground hover:bg-accent-soft disabled:opacity-60",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-[var(--radius-card)] px-4 py-2 text-sm font-medium transition-[color,background-color,border-color,transform] duration-[var(--motion-fast)] active:scale-[0.99] disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
