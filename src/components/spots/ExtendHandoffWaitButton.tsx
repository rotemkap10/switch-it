"use client";

import { useActionState, useEffect, useRef } from "react";

import {
  extendHandoffWait,
  type ExtendHandoffWaitActionState,
} from "@/actions/claims";
import { useActionFeedback } from "@/components/feedback/useActionFeedback";
import { Button } from "@/components/ui/Button";
import { formatHandoffExtensionButtonLabel } from "@/lib/spots/constants";

const initialState: ExtendHandoffWaitActionState = {};

type ExtendHandoffWaitButtonProps = {
  claimId: string;
  handoffStartedAtIso: string;
  expiresAtIso: string;
  onExtended?: (result: {
    expiresAt: string;
    extensionUsedAt?: string | null;
  }) => void;
};

export function ExtendHandoffWaitButton({
  claimId,
  handoffStartedAtIso,
  expiresAtIso,
  onExtended,
}: ExtendHandoffWaitButtonProps) {
  const [state, formAction, pending] = useActionState(
    extendHandoffWait,
    initialState,
  );
  const appliedSuccessRef = useRef<string | null>(null);

  const label = formatHandoffExtensionButtonLabel(
    handoffStartedAtIso,
    expiresAtIso,
  );

  useActionFeedback(state, {
    successMessage: (s) =>
      s.changed ? "Waiting time extended." : "Maximum wait already reached.",
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
    onExtended?.({
      expiresAt: state.expiresAt,
      extensionUsedAt: state.changed ? state.expiresAt : undefined,
    });
  }, [state.success, state.expiresAt, state.changed, onExtended]);

  if (!label) {
    return null;
  }

  return (
    <form action={formAction} className="w-full">
      <input type="hidden" name="claim_id" value={claimId} />
      <Button
        type="submit"
        variant="secondary"
        loading={pending}
        disabled={pending}
        className="w-full"
        data-testid="extend-handoff-wait"
        aria-label={label}
      >
        {pending ? "Extending…" : label}
      </Button>
    </form>
  );
}
