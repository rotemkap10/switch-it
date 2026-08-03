"use client";

import { useActionState } from "react";

import { claimSpot, type ClaimSpotActionState } from "@/actions/claims";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

const initialState: ClaimSpotActionState = {};

type ClaimSpotButtonProps = {
  spotId: string;
};

export function ClaimSpotButton({ spotId }: ClaimSpotButtonProps) {
  const [state, formAction, pending] = useActionState(claimSpot, initialState);

  if (state.success) {
    return (
      <Alert tone="success" title="You’re on your way">
        {state.claimExpiresAt
          ? `Hold this spot until ${new Date(state.claimExpiresAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}.`
          : "Head over before the hold expires."}
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="spot_id" value={spotId} />
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "On my way…" : "I’m on my way"}
      </Button>
    </form>
  );
}
