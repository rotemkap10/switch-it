"use client";

import { stopHandoffTrackingBestEffort } from "@/lib/location/handoff-location-service";

/** Call from logout forms before the server action runs. */
export function onLogoutSubmit(): void {
  void stopHandoffTrackingBestEffort("logout");
}
