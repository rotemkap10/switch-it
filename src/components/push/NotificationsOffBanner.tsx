"use client";

import { Alert } from "@/components/ui/Alert";

export const NOTIFICATIONS_OFF_WARNING_TITLE = "Notifications are off";
export const NOTIFICATIONS_OFF_WARNING_BODY =
  "You may miss important handoff updates while navigating.";

export function NotificationsOffBanner() {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,var(--app-safe-top))] z-[70] flex justify-center px-4"
      data-testid="handoff-push-notifications-off"
    >
      <div className="pointer-events-auto w-full max-w-lg">
        <Alert tone="warning" title={NOTIFICATIONS_OFF_WARNING_TITLE}>
          {NOTIFICATIONS_OFF_WARNING_BODY}
        </Alert>
      </div>
    </div>
  );
}
