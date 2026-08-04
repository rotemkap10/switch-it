import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  interactive?: boolean;
};

export function Card({
  children,
  className = "",
  interactive = false,
  ...props
}: CardProps) {
  return (
    <div
      className={[
        "rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)]",
        interactive ? "motion-card-hover" : "",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}
