"use client";

import { Suspense, type ReactNode } from "react";

import { FeedbackShell } from "@/components/feedback/FeedbackShell";
import { FeedbackUrlListener } from "@/components/feedback/FeedbackUrlListener";
import { AppLaunchShell } from "@/components/shell/AppLaunchShell";

export function AppFeedbackRoot({ children }: { children: ReactNode }) {
  return (
    <FeedbackShell>
      <AppLaunchShell>
        {children}
      </AppLaunchShell>
      <Suspense fallback={null}>
        <FeedbackUrlListener />
      </Suspense>
    </FeedbackShell>
  );
}
