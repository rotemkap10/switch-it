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
    <form
      action={formAction}
      className="mobile-form-fields onboarding-vehicle-form"
      data-testid="onboarding-vehicle-form"
    >
      <VehicleFields
        initialVehicle={initialVehicle}
        disabled={pending}
        showPreview
        previewSize="hero"
        placeholderPreview
        state={state}
      />

      <Button
        type="submit"
        loading={pending}
        disabled={pending}
        aria-busy={pending}
        className="mobile-form-primary"
      >
        {pending ? "Saving…" : "Start finding parking"}
      </Button>
    </form>
  );
}
