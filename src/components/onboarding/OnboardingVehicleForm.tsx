"use client";

import { useActionState } from "react";

import {
  completeVehicleOnboarding,
  type OnboardingVehicleActionState,
} from "@/actions/onboarding";
import { useActionFeedback } from "@/components/feedback/useActionFeedback";
import { VehicleFields } from "@/components/vehicle/VehicleFields";
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

  useActionFeedback(state, {
    toastErrors: true,
  });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <VehicleFields
        initialVehicle={initialVehicle}
        disabled={pending}
        showPreview
        state={state}
      />

      <Button
        type="submit"
        loading={pending}
        disabled={pending}
        className="w-full sm:w-fit"
      >
        {pending ? "Saving…" : "Continue to the map"}
      </Button>
    </form>
  );
}
