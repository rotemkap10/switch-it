"use client";

import { useActionState } from "react";

import {
  updateVehicle,
  type VehicleActionState,
} from "@/actions/profile";
import { useActionFeedback } from "@/components/feedback/useActionFeedback";
import { VehicleFields } from "@/components/vehicle/VehicleFields";
import { Button } from "@/components/ui/Button";
import { FEEDBACK_SUCCESS_KEYS } from "@/lib/feedback/success-keys";
import { isVehicleProfileComplete } from "@/lib/vehicle/profile-fields";
import type { VehicleProfileFields } from "@/lib/vehicle/profile-fields";

const initialState: VehicleActionState = {};

export type VehicleFormValues = VehicleProfileFields;

type VehicleFormProps = {
  initialVehicle: VehicleFormValues;
  requiresSetup?: boolean;
};

export function VehicleForm({
  initialVehicle,
  requiresSetup = false,
}: VehicleFormProps) {
  const hasVehicle = isVehicleProfileComplete(initialVehicle);
  const [state, formAction, pending] = useActionState(
    updateVehicle,
    initialState,
  );

  useActionFeedback(state, {
    successMessage: FEEDBACK_SUCCESS_KEYS["vehicle-updated"],
    toastErrors: true,
  });

  const saved = state.vehicle ?? initialVehicle;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {requiresSetup && !hasVehicle && !state.success ? (
        <div
          className="rounded-[var(--radius-card)] border border-dashed border-border bg-accent-soft/50 px-4 py-3 text-sm text-muted"
          data-testid="vehicle-setup-required"
        >
          Vehicle setup required before you can publish or claim new spots.
        </div>
      ) : null}

      <VehicleFields
        initialVehicle={saved}
        disabled={pending}
        showSummary={hasVehicle}
        showPreview
        state={state}
      />

      <p className="text-xs text-muted">
        Vehicle details will be used during active parking handoffs.
      </p>

      {requiresSetup ? (
        <input type="hidden" name="complete_setup" value="1" />
      ) : null}

      <Button type="submit" loading={pending} disabled={pending} className="w-fit">
        {pending ? "Saving…" : requiresSetup ? "Save and continue" : "Save vehicle"}
      </Button>
    </form>
  );
}
