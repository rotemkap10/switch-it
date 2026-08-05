"use client";

import { useActionState } from "react";

import {
  completeVehicleOnboarding,
  type OnboardingVehicleActionState,
} from "@/actions/onboarding";
import { VehicleFields } from "@/components/vehicle/VehicleFields";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import type { VehicleProfileFields } from "@/lib/vehicle/profile-fields";

const initialState: OnboardingVehicleActionState = {};

type OnboardingVehicleFormProps = {
  initialVehicle: VehicleProfileFields;
};

export function OnboardingVehicleForm({
  initialVehicle,
}: OnboardingVehicleFormProps) {
  const [state, formAction, pending] = useActionState(
    completeVehicleOnboarding,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <VehicleFields
        initialVehicle={initialVehicle}
        disabled={pending}
        showPreview
        state={state}
      />

      {state.fieldErrors?.form?.[0] ? (
        <Alert tone="error">{state.fieldErrors.form[0]}</Alert>
      ) : null}
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <Button type="submit" disabled={pending} className="w-full sm:w-fit">
        {pending ? "Saving…" : "Continue to the map"}
      </Button>
    </form>
  );
}
