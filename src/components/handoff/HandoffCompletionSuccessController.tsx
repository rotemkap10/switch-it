"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { HandoffCompletionSuccessOverlay } from "@/components/handoff/HandoffCompletionSuccessOverlay";
import { useHandoffOverlayReturnToMap } from "@/components/handoff/useHandoffOverlayReturnToMap";
import {
  dismissHandoffCompletionSuccess,
  HANDOFF_COMPLETION_SUCCESS_MS,
  subscribeHandoffCompletionSuccess,
  type HandoffCompletionSuccessEvent,
} from "@/lib/handoff/handoff-completion-success";

/**
 * Lives on the root client shell so the overlay survives page navigation
 * (`/spots/new` → `/map`) and RSC refresh. Overlay appears immediately;
 * Find Parking is prepared underneath; dismiss waits for a real map-ready
 * signal (with a fallback timeout so the overlay cannot stick forever).
 */
export function HandoffCompletionSuccessController() {
  const [event, setEvent] = useState<HandoffCompletionSuccessEvent | null>(
    null,
  );

  useEffect(() => {
    return subscribeHandoffCompletionSuccess(setEvent);
  }, []);

  const { exiting, onContinue } = useHandoffOverlayReturnToMap({
    activeId: event?.claimId ?? null,
    minVisibleMs: HANDOFF_COMPLETION_SUCCESS_MS,
    dismiss: dismissHandoffCompletionSuccess,
  });

  if (!event || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <HandoffCompletionSuccessOverlay
      role={event.role}
      exiting={exiting}
      onContinue={onContinue}
    />,
    document.body,
  );
}
