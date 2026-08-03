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
      <Alert tone="success" title="Spot claimed">
        {state.claimExpiresAt
          ? `Claim expires ${new Date(state.claimExpiresAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}.`
          : "Your claim is active."}
      </Alert>
    );
  }

  return (
    <form action={formAction} className="mt-2 space-y-2">
      <input type="hidden" name="spot_id" value={spotId} />
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Claiming…" : "Claim spot"}
      </Button>
    </form>
  );
}
