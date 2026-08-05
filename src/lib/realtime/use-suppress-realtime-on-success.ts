"use client";

import { useEffect } from "react";

import {
  suppressRealtimeFeedback,
  realtimeFeedbackKey,
} from "@/lib/realtime/feedback-suppression";

/** When a local mutation succeeds, suppress the matching Realtime toast. */
export function useSuppressRealtimeOnSuccess(
  success: boolean | undefined,
  key: string | null,
): void {
  useEffect(() => {
    if (success && key) {
      suppressRealtimeFeedback(key);
    }
  }, [success, key]);
}

export { realtimeFeedbackKey };
