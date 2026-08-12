"use client";

import { useId, useRef, useState } from "react";

import {
  removeVehiclePhoto,
  saveVehiclePhotoPath,
} from "@/actions/vehicle-photo";
import { Button } from "@/components/ui/Button";
import {
  VEHICLE_PHOTO_ACCEPT,
  VEHICLE_PHOTO_TIMEOUT_MESSAGE,
  validateVehiclePhotoForUpload,
  withVehiclePhotoTimeout,
} from "@/lib/vehicle/photo";
import {
  removeUploadedVehiclePhoto,
  uploadVehiclePhotoToStorage,
} from "@/lib/vehicle/upload-vehicle-photo-client";

export type VehiclePhotoChange = {
  photoPath: string | null;
  photoUrl: string | null;
};

type VehiclePhotoControlsProps = {
  photoPath?: string | null;
  photoUrl?: string | null;
  disabled?: boolean;
  onPhotoChange?: (next: VehiclePhotoChange) => void;
};

export function VehiclePhotoControls({
  photoPath = null,
  photoUrl = null,
  disabled = false,
  onPhotoChange,
}: VehiclePhotoControlsProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [action, setAction] = useState<"upload" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasPhoto = Boolean(photoPath || photoUrl);
  const pending = action !== null;
  const pickerLabel = hasPhoto ? "Change photo" : "Add photo";

  function resetInput() {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) {
      return;
    }

    setError(null);

    const parsed = await validateVehiclePhotoForUpload(file);
    if (!parsed.ok) {
      setError(parsed.message);
      resetInput();
      return;
    }

    setAction("upload");
    try {
      const uploaded = await uploadVehiclePhotoToStorage(file);
      if (!uploaded.ok) {
        setError(uploaded.error);
        return;
      }

      try {
        const saved = await withVehiclePhotoTimeout(
          saveVehiclePhotoPath(uploaded.photoPath),
        );
        if (!saved.success) {
          await removeUploadedVehiclePhoto(uploaded.photoPath);
          setError(saved.error ?? "Could not save your vehicle photo.");
          return;
        }

        onPhotoChange?.({
          photoPath: saved.photoPath ?? uploaded.photoPath,
          photoUrl: saved.photoUrl ?? null,
        });
      } catch (error) {
        await removeUploadedVehiclePhoto(uploaded.photoPath);
        throw error;
      }
    } catch (error) {
      setError(
        error instanceof Error && error.message === VEHICLE_PHOTO_TIMEOUT_MESSAGE
          ? VEHICLE_PHOTO_TIMEOUT_MESSAGE
          : "Could not upload your vehicle photo.",
      );
    } finally {
      setAction(null);
      resetInput();
    }
  }

  async function handleRemove() {
    setError(null);
    setAction("remove");
    try {
      const result = await removeVehiclePhoto();
      if (!result.success) {
        setError(result.error ?? "Could not remove your vehicle photo.");
        return;
      }

      onPhotoChange?.({ photoPath: null, photoUrl: null });
    } catch {
      setError("Could not remove your vehicle photo.");
    } finally {
      setAction(null);
    }
  }

  return (
    <div className="vehicle-photo-controls" data-testid="vehicle-photo-controls">
      <div>
        <p className="text-sm font-medium text-foreground">Add a photo of your car</p>
        <p className="mt-0.5 text-xs leading-5 text-muted">
          Optional — helps other drivers recognize you during the handoff.
        </p>
      </div>

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept={VEHICLE_PHOTO_ACCEPT}
        aria-label="Vehicle photo"
        className="sr-only"
        disabled={disabled || pending}
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
        }}
      />

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={disabled || pending}
          loading={action === "upload"}
          className="mobile-form-primary min-h-[var(--app-tap-min)] sm:!mx-0 sm:!w-auto"
          data-testid="vehicle-photo-picker"
          onClick={() => inputRef.current?.click()}
        >
          {action === "upload" ? "Uploading…" : pickerLabel}
        </Button>
        {hasPhoto ? (
          <Button
            type="button"
            variant="ghost"
            disabled={disabled || pending}
            loading={action === "remove"}
            className="min-h-[var(--app-tap-min)]"
            onClick={() => {
              void handleRemove();
            }}
          >
            {action === "remove" ? "Removing…" : "Remove photo"}
          </Button>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-danger" role="alert" data-testid="vehicle-photo-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
