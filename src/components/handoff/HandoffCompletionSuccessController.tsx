"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { HandoffCompletionSuccessOverlay } from "@/components/handoff/HandoffCompletionSuccessOverlay";
import {
  dismissHandoffCompletionSuccess,
  HANDOFF_COMPLETION_SUCCESS_MS,
  subscribeHandoffCompletionSuccess,
  type HandoffCompletionSuccessEvent,
} from "@/lib/handoff/handoff-completion-success";
import { MODE_HOME } from "@/lib/mode/constants";

/**
 * Lives on the authenticated shell so the overlay survives RSC refresh
 * after the claim UI unmounts. Navigation to Find Parking happens only
 * after this success state has been shown.
 */
export function HandoffCompletionSuccessController() {
  const router = useRouter();
  const [event, setEvent] = useState<HandoffCompletionSuccessEvent | null>(
    null,
  );

  useEffect(() => {
    return subscribeHandoffCompletionSuccess(setEvent);
  }, []);

  const finish = useCallback(() => {
    dismissHandoffCompletionSuccess();
    router.replace(MODE_HOME.seeker);
  }, [router]);

  useEffect(() => {
    if (!event) {
      return;
    }
    const id = window.setTimeout(finish, HANDOFF_COMPLETION_SUCCESS_MS);
    return () => window.clearTimeout(id);
  }, [event, finish]);

  if (!event || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <HandoffCompletionSuccessOverlay
      role={event.role}
      onContinue={finish}
    />,
    document.body,
  );
}
