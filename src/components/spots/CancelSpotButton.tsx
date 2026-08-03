"use client";

import { useActionState } from "react";

import {
  cancelSpot,
  type CancelSpotActionState,
} from "@/actions/spots";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

const initialState: CancelSpotActionState = {};

type CancelSpotButtonProps = {
  spotId: string;
};

export function CancelSpotButton({ spotId }: CancelSpotButtonProps) {
  const [state, formAction, pending] = useActionState(
    cancelSpot,
    initialState,
  );

  if (state.success) {
    return (
      <Alert
        tone="success"
        title={
          state.alreadyCancelled
            ? "Spot was already removed"
            : "Spot removed"
        }
      >
        Your spot is no longer listed.
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="spot_id" value={spotId} />
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <Button
        type="submit"
        variant="ghost"
        disabled={pending}
        className="px-0 text-muted hover:text-foreground"
      >
        {pending ? "Updating…" : "This spot is no longer available"}
      </Button>
    </form>
  );
}
