import type { ReactNode } from "react";

type AlertTone = "info" | "success" | "error" | "warning";

type AlertProps = {
  children: ReactNode;
  tone?: AlertTone;
  title?: string;
};

const toneClasses: Record<AlertTone, string> = {
  info: "border-border bg-accent-soft text-foreground",
  success: "border-success/20 bg-success-bg text-success",
  error: "border-danger/20 bg-danger-bg text-danger",
  warning: "border-warning/20 bg-warning-bg text-warning",
};

export function Alert({ children, tone = "info", title }: AlertProps) {
  return (
    <div
      className={`rounded-[var(--radius-card)] border px-4 py-3 text-sm ${toneClasses[tone]}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {title ? <p className="font-semibold">{title}</p> : null}
      <div className={title ? "mt-1" : undefined}>{children}</div>
    </div>
  );
}
