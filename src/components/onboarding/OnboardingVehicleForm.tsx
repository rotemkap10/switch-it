"use client";

import { useActionState, useState } from "react";

import {
  completeVehicleOnboarding,
  type OnboardingVehicleActionState,
} from "@/actions/onboarding";
import { useActionFeedback } from "@/components/feedback/useActionFeedback";
import { VehicleFields } from "@/components/vehicle/VehicleFields";
import { VehiclePhotoControls } from "@/components/vehicle/VehiclePhotoControls";
import { Button } from "@/components/ui/Button";
import type { VehicleProfileFields } from "@/lib/vehicle/profile-fields";

const initialState: OnboardingVehicleActionState = {};

type OnboardingVehicleFormProps = {
  initialVehicle: VehicleProfileFields;
  initialPhotoUrl?: string | null;
};

export function OnboardingVehicleForm({
  initialVehicle,
  initialPhotoUrl = null,
}: OnboardingVehicleFormProps) {
  const [state, formAction, pending] = useActionState(
    completeVehicleOnboarding,
    initialState,
  );
  const [photoPath, setPhotoPath] = useState(
    initialVehicle.vehicle_photo_path ?? null,
  );
  const [photoUrl, setPhotoUrl] = useState(initialPhotoUrl);

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
        photoUrl={photoUrl}
        state={state}
      />

      <VehiclePhotoControls
        photoPath={photoPath}
        photoUrl={photoUrl}
        disabled={pending}
        onPhotoChange={(next) => {
          setPhotoPath(next.photoPath);
          setPhotoUrl(next.photoUrl);
        }}
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
