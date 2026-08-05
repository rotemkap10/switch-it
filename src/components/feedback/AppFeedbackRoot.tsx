"use client";

import { Suspense, type ReactNode } from "react";

import { FeedbackShell } from "@/components/feedback/FeedbackShell";
import { FeedbackUrlListener } from "@/components/feedback/FeedbackUrlListener";

export function AppFeedbackRoot({ children }: { children: ReactNode }) {
  return (
    <FeedbackShell>
      {children}
      <Suspense fallback={null}>
        <FeedbackUrlListener />
      </Suspense>
    </FeedbackShell>
  );
}
