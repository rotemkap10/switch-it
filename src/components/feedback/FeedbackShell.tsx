"use client";

import type { ReactNode } from "react";

import { FeedbackProvider } from "@/components/feedback/FeedbackProvider";
import { FeedbackViewport } from "@/components/feedback/FeedbackViewport";

/** Provider + viewport only (safe for unit tests without App Router). */
export function FeedbackShell({ children }: { children: ReactNode }) {
  return (
    <FeedbackProvider>
      {children}
      <FeedbackViewport />
    </FeedbackProvider>
  );
}
