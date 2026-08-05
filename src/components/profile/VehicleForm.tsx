"use client";

import { useActionState, useMemo, useState } from "react";

import {
  updateVehicle,
  type VehicleActionState,
} from "@/actions/profile";
import { VehicleIllustration } from "@/components/vehicle/VehicleIllustration";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  VEHICLE_COLOR_LABELS,
  VEHICLE_COLORS,
  isVehicleColor,
  type VehicleColor,
} from "@/lib/vehicle/colors";
import { formatLicensePlateForDisplay } from "@/lib/vehicle/normalize-plate";
import {
  VEHICLE_TYPE_LABELS,
  VEHICLE_TYPES,
  isVehicleType,
  type VehicleType,
} from "@/lib/vehicle/types";
import { hasCompleteVehicleProfile } from "@/lib/validations/vehicle";

const initialState: VehicleActionState = {};

export type VehicleFormValues = {
  license_plate: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  vehicle_type: string | null;
};

type VehicleFormProps = {
  initialVehicle: VehicleFormValues;
};

export function VehicleForm({ initialVehicle }: VehicleFormProps) {
  const hasVehicle = hasCompleteVehicleProfile(initialVehicle);
  const [state, formAction, pending] = useActionState(
    updateVehicle,
    initialState,
  );

  const saved = state.vehicle ?? (hasVehicle ? initialVehicle : null);

  const [vehicleType, setVehicleType] = useState(
    () =>
      (saved && isVehicleType(saved.vehicle_type ?? "")
        ? saved.vehicle_type
        : "") as string,
  );
  const [vehicleColor, setVehicleColor] = useState(
    () =>
      (saved && isVehicleColor(saved.vehicle_color ?? "")
        ? saved.vehicle_color
        : "") as string,
  );

  const previewType: VehicleType | null = isVehicleType(vehicleType)
    ? vehicleType
    : null;
  const previewColor: VehicleColor | null = isVehicleColor(vehicleColor)
    ? vehicleColor
    : null;

  const typeOptions = useMemo(
    () => [
      { value: "", label: "Select type", disabled: true },
      ...VEHICLE_TYPES.map((type) => ({
        value: type,
        label: VEHICLE_TYPE_LABELS[type],
      })),
    ],
    [],
  );

  const colorOptions = useMemo(
    () => [
      { value: "", label: "Select color", disabled: true },
      ...VEHICLE_COLORS.map((color) => ({
        value: color,
        label: VEHICLE_COLOR_LABELS[color],
      })),
    ],
    [],
  );

  const plateDefault =
    saved?.license_plate != null && saved.license_plate !== ""
      ? formatLicensePlateForDisplay(saved.license_plate)
      : "";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {!hasVehicle && !state.success ? (
        <div
          className="rounded-[var(--radius-card)] border border-dashed border-border bg-accent-soft/50 px-4 py-3 text-sm text-muted"
          data-testid="vehicle-empty-state"
        >
          No vehicle saved yet. Add your details so drivers can recognize you
          during a handoff.
        </div>
      ) : null}

      {previewType && previewColor ? (
        <VehicleIllustration
          vehicleType={previewType}
          vehicleColor={previewColor}
          label={`${VEHICLE_COLOR_LABELS[previewColor]} ${VEHICLE_TYPE_LABELS[previewType]}`}
        />
      ) : null}

      {saved && hasCompleteVehicleProfile(saved) ? (
        <p className="text-sm text-foreground" data-testid="vehicle-summary">
          {VEHICLE_COLOR_LABELS[saved.vehicle_color as VehicleColor]}{" "}
          {VEHICLE_TYPE_LABELS[saved.vehicle_type as VehicleType]}
          <span className="mt-0.5 block text-muted">
            {saved.vehicle_make} {saved.vehicle_model}
          </span>
          <span className="mt-0.5 block font-semibold tracking-wide">
            {formatLicensePlateForDisplay(saved.license_plate ?? "")}
          </span>
        </p>
      ) : null}

      <Select
        id="vehicle_type"
        name="vehicle_type"
        label="Vehicle type"
        options={typeOptions}
        value={vehicleType}
        onChange={(event) => setVehicleType(event.target.value)}
        disabled={pending}
        error={state.fieldErrors?.vehicle_type?.[0]}
      />

      <Select
        id="vehicle_color"
        name="vehicle_color"
        label="Color"
        options={colorOptions}
        value={vehicleColor}
        onChange={(event) => setVehicleColor(event.target.value)}
        disabled={pending}
        error={state.fieldErrors?.vehicle_color?.[0]}
      />

      <Input
        id="vehicle_make"
        name="vehicle_make"
        label="Make"
        type="text"
        maxLength={40}
        defaultValue={saved?.vehicle_make ?? ""}
        key={`make-${saved?.vehicle_make ?? "empty"}`}
        disabled={pending}
        placeholder="e.g. Hyundai"
        error={state.fieldErrors?.vehicle_make?.[0]}
      />

      <Input
        id="vehicle_model"
        name="vehicle_model"
        label="Model"
        type="text"
        maxLength={40}
        defaultValue={saved?.vehicle_model ?? ""}
        key={`model-${saved?.vehicle_model ?? "empty"}`}
        disabled={pending}
        placeholder="e.g. Tucson"
        error={state.fieldErrors?.vehicle_model?.[0]}
      />

      <Input
        id="license_plate"
        name="license_plate"
        label="License plate"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        defaultValue={plateDefault}
        key={`plate-${saved?.license_plate ?? "empty"}`}
        disabled={pending}
        placeholder="e.g. 12-345-67"
        hint="Digits only; separators are fine."
        error={state.fieldErrors?.license_plate?.[0]}
      />

      {state.fieldErrors?.form?.[0] ? (
        <Alert tone="error">{state.fieldErrors.form[0]}</Alert>
      ) : null}
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? (
        <Alert tone="success">
          {state.vehicle ? "Vehicle saved." : "Vehicle details cleared."}
        </Alert>
      ) : null}

      <p className="text-xs text-muted">
        Vehicle details will be used during active parking handoffs.
      </p>

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Saving…" : "Save vehicle"}
      </Button>
    </form>
  );
}
