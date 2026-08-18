"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

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
};

export function StartHandoffNowButton({ spotId }: StartHandoffNowButtonProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    startHandoffNow,
    initialState,
  );
  const refreshedForSuccessRef = useRef<string | null>(null);

  useActionFeedback(state, {
    successMessage: FEEDBACK_SUCCESS_KEYS["handoff-started"],
    toastErrors: true,
  });

  useEffect(() => {
    if (!state.success || !state.expiresAt) {
      return;
    }
    if (refreshedForSuccessRef.current === state.expiresAt) {
      return;
    }
    refreshedForSuccessRef.current = state.expiresAt;
    router.refresh();
  }, [state.success, state.expiresAt, router]);

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
