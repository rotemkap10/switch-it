"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

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
  availableAtIso: string;
  expiresAtIso: string;
};

export function ExtendHandoffWaitButton({
  claimId,
  availableAtIso,
  expiresAtIso,
}: ExtendHandoffWaitButtonProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    extendHandoffWait,
    initialState,
  );
  const refreshedForSuccessRef = useRef<string | null>(null);

  const label = formatHandoffExtensionButtonLabel(
    availableAtIso,
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
    if (refreshedForSuccessRef.current === state.expiresAt) {
      return;
    }
    refreshedForSuccessRef.current = state.expiresAt;
    router.refresh();
  }, [state.success, state.expiresAt, router]);

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
