"use client";

import { useFeedback, type FeedbackTone } from "@/components/feedback/FeedbackProvider";

function StatusIcon({ tone }: { tone: FeedbackTone }) {
  if (tone === "success") {
    return (
      <span
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-bg text-success"
        aria-hidden="true"
      >
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none">
          <path
            d="M3.5 8.5 6.5 11.5 12.5 4.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  if (tone === "error") {
    return (
      <span
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-danger-bg text-danger"
        aria-hidden="true"
      >
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none">
          <path
            d="M4 4l8 8M12 4l-8 8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </span>
    );
  }

  return (
    <span
      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-hover"
      aria-hidden="true"
    >
      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor">
        <circle cx="8" cy="8" r="6" opacity="0.25" />
        <circle cx="8" cy="8" r="2.5" />
      </svg>
    </span>
  );
}

export function FeedbackViewport() {
  const { items, dismiss } = useFeedback();

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="feedback-viewport"
      className={[
        "pointer-events-none fixed z-[45] flex w-full max-w-sm flex-col gap-2 px-3",
        // Mobile: above safe area. Desktop: top-right under header.
        "bottom-[var(--app-toast-offset)]",
        "md:bottom-auto md:right-4 md:top-[calc(var(--app-header-height)+0.75rem)] md:left-auto md:px-0",
      ].join(" ")}
    >
      {items.map((item) => (
        <div
          key={item.id}
          data-testid={`feedback-toast-${item.tone}`}
          className={[
            "pointer-events-auto flex items-start gap-2.5 rounded-[var(--radius-card)] border border-border bg-surface px-3.5 py-3",
            "text-sm text-foreground shadow-[var(--shadow-card)] motion-feedback-enter",
          ].join(" ")}
          role={item.tone === "error" ? "alert" : "status"}
          aria-live={item.tone === "error" ? "assertive" : "polite"}
          aria-atomic="true"
        >
          <StatusIcon tone={item.tone} />
          <p className="min-w-0 flex-1 leading-5">{item.message}</p>
          <button
            type="button"
            className="shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium text-muted hover:bg-accent-soft hover:text-foreground"
            aria-label="Dismiss notification"
            onClick={() => dismiss(item.id)}
          >
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );
}
