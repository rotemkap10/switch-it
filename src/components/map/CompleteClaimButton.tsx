"use client";

import { useActionState } from "react";

import {
  completeClaim,
  type CompleteClaimActionState,
} from "@/actions/claims";

const initialState: CompleteClaimActionState = {};

type CompleteClaimButtonProps = {
  claimId: string;
};

export function CompleteClaimButton({ claimId }: CompleteClaimButtonProps) {
  const [state, formAction, pending] = useActionState(
    completeClaim,
    initialState,
  );

  if (state.success) {
    return (
      <div className="space-y-1 text-sm" role="status">
        <p className="font-medium text-green-700">
          {state.alreadyCompleted
            ? "Handoff was already completed."
            : "Handoff completed."}
        </p>
        {typeof state.seekerCredits === "number" ? (
          <p className="text-zinc-600">
            Your credit balance is now {state.seekerCredits}.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="claim_id" value={claimId} />
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
        {pending ? "Completing…" : "Complete handoff"}
      </button>
    </form>
  );
}
