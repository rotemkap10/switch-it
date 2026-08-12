"use client";

import { Suspense, useEffect, type ReactNode } from "react";

import { FeedbackShell } from "@/components/feedback/FeedbackShell";
import { FeedbackUrlListener } from "@/components/feedback/FeedbackUrlListener";
import { AppLaunchShell } from "@/components/shell/AppLaunchShell";
import { RouteTransitionProvider } from "@/components/shell/RouteTransitionProvider";
import { installSensoryAudioUnlock } from "@/lib/sensory/sounds";

export function AppFeedbackRoot({ children }: { children: ReactNode }) {
  useEffect(() => {
    installSensoryAudioUnlock();
  }, []);

  return (
    <FeedbackShell>
      <AppLaunchShell>
        <Suspense fallback={null}>
          <RouteTransitionProvider>{children}</RouteTransitionProvider>
        </Suspense>
      </AppLaunchShell>
      <Suspense fallback={null}>
        <FeedbackUrlListener />
      </Suspense>
    </FeedbackShell>
  );
}
