"use client";

import { useActionState } from "react";

import {
  updateVehicle,
  type VehicleActionState,
} from "@/actions/profile";
import { VehicleFields } from "@/components/vehicle/VehicleFields";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
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

  const saved = state.vehicle ?? (hasVehicle ? initialVehicle : initialVehicle);

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

      {state.fieldErrors?.form?.[0] ? (
        <Alert tone="error">{state.fieldErrors.form[0]}</Alert>
      ) : null}
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? (
        <Alert tone="success">Vehicle saved.</Alert>
      ) : null}

      <p className="text-xs text-muted">
        Vehicle details will be used during active parking handoffs.
      </p>

      {requiresSetup ? (
        <input type="hidden" name="complete_setup" value="1" />
      ) : null}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Saving…" : requiresSetup ? "Save and continue" : "Save vehicle"}
      </Button>
    </form>
  );
}
