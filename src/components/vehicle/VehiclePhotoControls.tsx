"use client";

import { useId, useRef, useState } from "react";

import {
  removeVehiclePhoto,
  uploadVehiclePhoto,
} from "@/actions/vehicle-photo";
import { Button } from "@/components/ui/Button";
import { VEHICLE_PHOTO_ACCEPT } from "@/lib/vehicle/photo";

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

  async function handleFile(file: File | undefined) {
    if (!file) {
      return;
    }

    setError(null);
    setAction("upload");
    const formData = new FormData();
    formData.set("photo", file);
    const result = await uploadVehiclePhoto(formData);
    setAction(null);

    if (!result.success) {
      setError(result.error ?? "Could not upload your vehicle photo.");
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      return;
    }

    onPhotoChange?.({
      photoPath: result.photoPath ?? null,
      photoUrl: result.photoUrl ?? null,
    });
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    setError(null);
    setAction("remove");
    const result = await removeVehiclePhoto();
    setAction(null);

    if (!result.success) {
      setError(result.error ?? "Could not remove your vehicle photo.");
      return;
    }

    onPhotoChange?.({ photoPath: null, photoUrl: null });
    if (inputRef.current) {
      inputRef.current.value = "";
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

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={disabled || pending}
          loading={action === "upload"}
          className="min-h-[var(--app-tap-min)]"
          onClick={() => inputRef.current?.click()}
        >
          {action === "upload"
            ? "Uploading…"
            : hasPhoto
              ? "Change photo"
              : "Add vehicle photo"}
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
