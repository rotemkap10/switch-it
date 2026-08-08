"use client";

import type { ReactNode } from "react";

import { FeedbackProvider } from "@/components/feedback/FeedbackProvider";
import { FeedbackViewport } from "@/components/feedback/FeedbackViewport";
import { PostClaimNavigationProvider } from "@/components/map/PostClaimNavigationProvider";

/** Provider + viewport only (safe for unit tests without App Router). */
export function FeedbackShell({ children }: { children: ReactNode }) {
  return (
    <FeedbackProvider>
      <PostClaimNavigationProvider>
        {children}
        <FeedbackViewport />
      </PostClaimNavigationProvider>
    </FeedbackProvider>
  );
}
