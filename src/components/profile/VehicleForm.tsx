"use client";

import { useActionState, useRef, useState } from "react";

import {
  updateVehicle,
  type VehicleActionState,
} from "@/actions/profile";
import { useActionFeedback } from "@/components/feedback/useActionFeedback";
import { VehicleProfileSummary } from "@/components/profile/VehicleProfileSummary";
import { VehicleFields } from "@/components/vehicle/VehicleFields";
import { VehiclePhotoControls } from "@/components/vehicle/VehiclePhotoControls";
import { Button } from "@/components/ui/Button";
import { FEEDBACK_SUCCESS_KEYS } from "@/lib/feedback/success-keys";
import { isVehicleProfileComplete } from "@/lib/vehicle/profile-fields";
import type { VehicleProfileFields } from "@/lib/vehicle/profile-fields";

const initialState: VehicleActionState = {};

export type VehicleFormValues = VehicleProfileFields;

type VehicleFormProps = {
  initialVehicle: VehicleFormValues;
  initialPhotoUrl?: string | null;
  requiresSetup?: boolean;
};

export function VehicleForm({
  initialVehicle,
  initialPhotoUrl = null,
  requiresSetup = false,
}: VehicleFormProps) {
  const hasVehicle = isVehicleProfileComplete(initialVehicle);
  const [editing, setEditing] = useState(
    () => requiresSetup || !hasVehicle,
  );
  const [formKey, setFormKey] = useState(0);
  const [photoPath, setPhotoPath] = useState(
    initialVehicle.vehicle_photo_path ?? null,
  );
  const [photoUrl, setPhotoUrl] = useState(initialPhotoUrl);
  const editButtonRef = useRef<HTMLButtonElement>(null);

  const [state, dispatch, pending] = useActionState(
    async (prev: VehicleActionState, formData: FormData) => {
      const result = await updateVehicle(prev, formData);
      if (result.success && isVehicleProfileComplete(result.vehicle)) {
        setEditing(false);
        queueMicrotask(() => editButtonRef.current?.focus());
      }
      return result;
    },
    initialState,
  );

  useActionFeedback(state, {
    successMessage: FEEDBACK_SUCCESS_KEYS["vehicle-updated"],
    toastErrors: true,
  });

  const saved = state.vehicle ?? initialVehicle;
  const savedComplete = isVehicleProfileComplete(saved);
  const showEditor = editing || !savedComplete;

  function startEditing() {
    setFormKey((key) => key + 1);
    setEditing(true);
  }

  function cancelEditing() {
    if (!savedComplete) {
      return;
    }
    setFormKey((key) => key + 1);
    setEditing(false);
    queueMicrotask(() => editButtonRef.current?.focus());
  }

  return (
    <div className="flex flex-col gap-4">
      {requiresSetup && !savedComplete && !state.success ? (
        <div
          className="rounded-[var(--radius-card)] border border-dashed border-border bg-accent-soft/50 px-3.5 py-2.5 text-sm text-muted"
          data-testid="vehicle-setup-required"
        >
          Vehicle setup required before you can publish or claim new spots.
        </div>
      ) : null}

      {!showEditor ? (
        <div className="flex flex-col gap-4" data-testid="vehicle-summary-panel">
          <VehicleProfileSummary
            vehicle={saved}
            photoUrl={photoUrl}
            variant="stacked"
            entranceAnimation
          />
          <VehiclePhotoControls
            photoPath={photoPath}
            photoUrl={photoUrl}
            onPhotoChange={(next) => {
              setPhotoPath(next.photoPath);
              setPhotoUrl(next.photoUrl);
            }}
          />
          <Button
            ref={editButtonRef}
            type="button"
            variant="secondary"
            onClick={startEditing}
            className="mobile-form-primary sm:!mx-0 sm:!w-auto"
            aria-expanded={false}
            aria-controls="vehicle-edit-panel"
          >
            Edit vehicle details
          </Button>
        </div>
      ) : (
        <div
          id="vehicle-edit-panel"
          className="motion-reveal-panel is-open"
          data-testid="vehicle-edit-panel"
          role="region"
          aria-label="Edit vehicle details"
        >
          <div className="motion-reveal-panel-inner">
            <form action={dispatch} className="mobile-form-fields" key={formKey}>
              <VehicleFields
                key={formKey}
                initialVehicle={saved}
                disabled={pending}
                showSummary={false}
                showPreview
                previewSize="hero"
                previewEmphasis
                photoUrl={photoUrl}
                state={state}
              />

              {requiresSetup ? (
                <input type="hidden" name="complete_setup" value="1" />
              ) : null}

              <div className="mobile-form-actions">
                {savedComplete ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={cancelEditing}
                    disabled={pending}
                    className="min-h-[var(--app-tap-min)]"
                    aria-expanded={true}
                    aria-controls="vehicle-edit-panel"
                  >
                    Cancel
                  </Button>
                ) : (
                  <span />
                )}
                <Button
                  type="submit"
                  loading={pending}
                  disabled={pending}
                  aria-busy={pending}
                  className="mobile-form-primary sm:!w-auto"
                >
                  {pending
                    ? "Saving…"
                    : requiresSetup
                      ? "Save and continue"
                      : "Save changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
