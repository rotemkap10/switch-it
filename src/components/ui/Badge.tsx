import type { ReactNode } from "react";

type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

type BadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
};

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-accent-soft text-foreground",
  accent: "bg-accent text-foreground",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
};

export function Badge({ children, tone = "neutral" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}
