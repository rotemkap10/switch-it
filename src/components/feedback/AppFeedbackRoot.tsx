"use client";

import { Suspense, useEffect, type ReactNode } from "react";

import { FeedbackShell } from "@/components/feedback/FeedbackShell";
import { FeedbackUrlListener } from "@/components/feedback/FeedbackUrlListener";
import { HandoffCompletionSuccessController } from "@/components/handoff/HandoffCompletionSuccessController";
import { HandoffTerminalEndedController } from "@/components/handoff/HandoffTerminalEndedController";
import { AppLaunchShell } from "@/components/shell/AppLaunchShell";
import { SafeAreaInsetsSync } from "@/components/shell/SafeAreaInsetsSync";
import { RouteTransitionProvider } from "@/components/shell/RouteTransitionProvider";
import { installSensoryAudioUnlock } from "@/lib/sensory/sounds";

export function AppFeedbackRoot({ children }: { children: ReactNode }) {
  useEffect(() => {
    installSensoryAudioUnlock();
  }, []);

  return (
    <FeedbackShell>
      <SafeAreaInsetsSync />
      <AppLaunchShell>
        <Suspense fallback={null}>
          <RouteTransitionProvider>{children}</RouteTransitionProvider>
        </Suspense>
      </AppLaunchShell>
      <Suspense fallback={null}>
        <FeedbackUrlListener />
      </Suspense>
      <Suspense fallback={null}>
        <HandoffCompletionSuccessController />
      </Suspense>
      <Suspense fallback={null}>
        <HandoffTerminalEndedController />
      </Suspense>
    </FeedbackShell>
  );
}
