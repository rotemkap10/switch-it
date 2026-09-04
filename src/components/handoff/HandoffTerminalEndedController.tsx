"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { HandoffTerminalEndedOverlay } from "@/components/handoff/HandoffTerminalEndedOverlay";
import { useHandoffOverlayReturnToMap } from "@/components/handoff/useHandoffOverlayReturnToMap";
import {
  dismissHandoffTerminalEnded,
  HANDOFF_TERMINAL_ENDED_MS,
  subscribeHandoffTerminalEnded,
  type HandoffTerminalEndedEvent,
} from "@/lib/handoff/handoff-terminal-ended";

/**
 * Root-shell overlay for cancel / release / expiry. Same return-to-map
 * readiness path as successful completion, with a shorter readable dwell.
 */
export function HandoffTerminalEndedController() {
  const [event, setEvent] = useState<HandoffTerminalEndedEvent | null>(null);

  useEffect(() => {
    return subscribeHandoffTerminalEnded(setEvent);
  }, []);

  const { exiting, onContinue } = useHandoffOverlayReturnToMap({
    activeId: event?.id ?? null,
    minVisibleMs: HANDOFF_TERMINAL_ENDED_MS,
    dismiss: dismissHandoffTerminalEnded,
  });

  if (!event || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <HandoffTerminalEndedOverlay
      role={event.role}
      kind={event.kind}
      exiting={exiting}
      onContinue={onContinue}
    />,
    document.body,
  );
}
