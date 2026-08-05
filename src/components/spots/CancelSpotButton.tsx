"use client";

import { useActionState } from "react";

import {
  cancelSpot,
  type CancelSpotActionState,
} from "@/actions/spots";
import { useActionFeedback } from "@/components/feedback/useActionFeedback";
import { Button } from "@/components/ui/Button";
import { FEEDBACK_SUCCESS_KEYS } from "@/lib/feedback/success-keys";
import {
  realtimeFeedbackKey,
  useSuppressRealtimeOnSuccess,
} from "@/lib/realtime/use-suppress-realtime-on-success";

const initialState: CancelSpotActionState = {};

type CancelSpotButtonProps = {
  spotId: string;
};

export function CancelSpotButton({ spotId }: CancelSpotButtonProps) {
  const [state, formAction, pending] = useActionState(
    cancelSpot,
    initialState,
  );

  useActionFeedback(state, {
    successMessage: FEEDBACK_SUCCESS_KEYS["spot-cancelled"],
    toastErrors: true,
  });

  useSuppressRealtimeOnSuccess(
    state.success,
    realtimeFeedbackKey("spot", spotId, "cancelled"),
  );

  if (state.success) {
    return (
      <p className="text-xs text-muted" role="status">
        Updating your spot…
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="spot_id" value={spotId} />
      <Button
        type="submit"
        variant="ghost"
        loading={pending}
        disabled={pending}
        className="w-full px-0 py-1 text-center text-xs text-muted underline-offset-2 hover:text-foreground hover:underline"
      >
        {pending ? "Cancelling…" : "This spot is no longer available"}
      </Button>
    </form>
  );
}
