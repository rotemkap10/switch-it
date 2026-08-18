"use client";

import { useActionState, useEffect, useRef } from "react";

import {
  startHandoffNow,
  type StartHandoffNowActionState,
} from "@/actions/spots";
import { useActionFeedback } from "@/components/feedback/useActionFeedback";
import { Button } from "@/components/ui/Button";
import { FEEDBACK_SUCCESS_KEYS } from "@/lib/feedback/success-keys";

const initialState: StartHandoffNowActionState = {};

type StartHandoffNowButtonProps = {
  spotId: string;
  onStarted?: (result: {
    handoffStartedAt?: string;
    expiresAt: string;
    alreadyStarted?: boolean;
  }) => void;
};

export function StartHandoffNowButton({
  spotId,
  onStarted,
}: StartHandoffNowButtonProps) {
  const [state, formAction, pending] = useActionState(
    startHandoffNow,
    initialState,
  );
  const appliedSuccessRef = useRef<string | null>(null);

  useActionFeedback(state, {
    successMessage: FEEDBACK_SUCCESS_KEYS["handoff-started"],
    toastErrors: true,
  });

  useEffect(() => {
    if (!state.success || !state.expiresAt) {
      return;
    }
    if (appliedSuccessRef.current === state.expiresAt) {
      return;
    }
    appliedSuccessRef.current = state.expiresAt;
    onStarted?.({
      handoffStartedAt: state.handoffStartedAt,
      expiresAt: state.expiresAt,
      alreadyStarted: state.alreadyStarted,
    });
  }, [
    state.success,
    state.expiresAt,
    state.handoffStartedAt,
    state.alreadyStarted,
    onStarted,
  ]);

  return (
    <form action={formAction} className="w-full">
      <input type="hidden" name="spot_id" value={spotId} />
      <Button
        type="submit"
        variant="primary"
        loading={pending}
        disabled={pending}
        className="w-full !min-h-[var(--app-tap-min)]"
        data-testid="start-handoff-now"
      >
        {pending ? "Starting…" : "I’m leaving now"}
      </Button>
    </form>
  );
}
