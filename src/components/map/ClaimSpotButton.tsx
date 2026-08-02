"use client";

import { useActionState } from "react";

import { claimSpot, type ClaimSpotActionState } from "@/actions/claims";

const initialState: ClaimSpotActionState = {};

type ClaimSpotButtonProps = {
  spotId: string;
};

export function ClaimSpotButton({ spotId }: ClaimSpotButtonProps) {
  const [state, formAction, pending] = useActionState(claimSpot, initialState);

  if (state.success) {
    return (
      <div className="space-y-1 text-sm" role="status">
        <p className="font-medium text-green-700">Spot claimed.</p>
        {state.claimExpiresAt ? (
          <p className="text-zinc-600">
            Claim expires:{" "}
            {new Date(state.claimExpiresAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-2 space-y-2">
      <input type="hidden" name="spot_id" value={spotId} />
      {state.error ? (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Claiming…" : "Claim spot"}
      </button>
    </form>
  );
}
