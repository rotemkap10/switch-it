import type { ReactNode } from "react";

type AlertTone = "info" | "success" | "error" | "warning";

type AlertProps = {
  children: ReactNode;
  tone?: AlertTone;
  title?: string;
};

const toneClasses: Record<AlertTone, string> = {
  info: "border border-border bg-accent-soft text-foreground",
  success: "border border-border bg-success-bg text-success",
  error: "border-2 border-accent bg-danger-bg text-danger font-medium",
  warning: "border-2 border-dashed border-accent bg-warning-bg text-warning font-medium",
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
