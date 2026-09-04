"use client";

import { useEffect } from "react";

import { useOptionalPostClaimNavigation } from "@/components/map/PostClaimNavigationProvider";
import { presentHandoffTerminalEnded } from "@/lib/handoff/handoff-terminal-ended";
import { subscribeSeekerHandoffTerminal } from "@/lib/handoff/seeker-handoff-terminal";

/**
 * Global seeker handoff teardown when a claim becomes terminal remotely
 * (publisher cancel, expiry, completion). Closes navigation UI. Non-success
 * terminal overlays own the return to Find parking.
 */
export function SeekerHandoffTerminalController() {
  const navigation = useOptionalPostClaimNavigation();

  useEffect(() => {
    return subscribeSeekerHandoffTerminal((event) => {
      navigation?.clearSession();

      // Completed handoff: success overlay owns the return to Find Parking.
      if (event.reason === "completed") {
        return;
      }

      if (event.reason === "publisher_cancel") {
        presentHandoffTerminalEnded({
          id: event.claimId,
          role: "seeker",
          kind: "publisher_cancelled",
        });
        return;
      }

      if (event.reason === "expired") {
        presentHandoffTerminalEnded({
          id: event.claimId,
          role: "seeker",
          kind: "expired",
        });
      }
    });
  }, [navigation]);

  return null;
}
