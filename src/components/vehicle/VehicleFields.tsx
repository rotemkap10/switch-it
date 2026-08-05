"use client";

import { useMemo, useState } from "react";

import { VehicleIllustration } from "@/components/vehicle/VehicleIllustration";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  VEHICLE_COLOR_LABELS,
  VEHICLE_COLORS,
  isVehicleColor,
  type VehicleColor,
} from "@/lib/vehicle/colors";
import { formatLicensePlateForDisplay } from "@/lib/vehicle/normalize-plate";
import type { VehicleProfileFields } from "@/lib/vehicle/profile-fields";
import {
  VEHICLE_TYPE_LABELS,
  VEHICLE_TYPES,
  isVehicleType,
  type VehicleType,
} from "@/lib/vehicle/types";

export type VehicleFieldsState = {
  fieldErrors?: Record<string, string[]>;
};

type VehicleFieldsProps = {
  initialVehicle: VehicleProfileFields;
  disabled?: boolean;
  showSummary?: boolean;
  showPreview?: boolean;
  state?: VehicleFieldsState;
};

export function VehicleFields({
  initialVehicle,
  disabled = false,
  showSummary = false,
  showPreview = true,
  state,
}: VehicleFieldsProps) {
  const [vehicleType, setVehicleType] = useState(
    () =>
      (isVehicleType(initialVehicle.vehicle_type ?? "")
        ? initialVehicle.vehicle_type
        : "") as string,
  );
  const [vehicleColor, setVehicleColor] = useState(
    () =>
      (isVehicleColor(initialVehicle.vehicle_color ?? "")
        ? initialVehicle.vehicle_color
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
    initialVehicle.license_plate != null && initialVehicle.license_plate !== ""
      ? formatLicensePlateForDisplay(initialVehicle.license_plate)
      : "";

  return (
    <>
      {showPreview && previewType && previewColor ? (
        <VehicleIllustration
          vehicleType={previewType}
          vehicleColor={previewColor}
          label={`${VEHICLE_COLOR_LABELS[previewColor]} ${VEHICLE_TYPE_LABELS[previewType]}`}
        />
      ) : null}

      {showSummary &&
      initialVehicle.license_plate &&
      isVehicleType(initialVehicle.vehicle_type ?? "") &&
      isVehicleColor(initialVehicle.vehicle_color ?? "") ? (
        <p className="text-sm text-foreground" data-testid="vehicle-summary">
          {VEHICLE_COLOR_LABELS[initialVehicle.vehicle_color as VehicleColor]}{" "}
          {VEHICLE_TYPE_LABELS[initialVehicle.vehicle_type as VehicleType]}
          <span className="mt-0.5 block text-muted">
            {initialVehicle.vehicle_make} {initialVehicle.vehicle_model}
          </span>
          <span className="mt-0.5 block font-semibold tracking-wide">
            {formatLicensePlateForDisplay(initialVehicle.license_plate)}
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
        disabled={disabled}
        error={state?.fieldErrors?.vehicle_type?.[0]}
      />

      <Select
        id="vehicle_color"
        name="vehicle_color"
        label="Color"
        options={colorOptions}
        value={vehicleColor}
        onChange={(event) => setVehicleColor(event.target.value)}
        disabled={disabled}
        error={state?.fieldErrors?.vehicle_color?.[0]}
      />

      <Input
        id="vehicle_make"
        name="vehicle_make"
        label="Make"
        type="text"
        maxLength={40}
        defaultValue={initialVehicle.vehicle_make ?? ""}
        key={`make-${initialVehicle.vehicle_make ?? "empty"}`}
        disabled={disabled}
        placeholder="e.g. Hyundai"
        error={state?.fieldErrors?.vehicle_make?.[0]}
      />

      <Input
        id="vehicle_model"
        name="vehicle_model"
        label="Model"
        type="text"
        maxLength={40}
        defaultValue={initialVehicle.vehicle_model ?? ""}
        key={`model-${initialVehicle.vehicle_model ?? "empty"}`}
        disabled={disabled}
        placeholder="e.g. Tucson"
        error={state?.fieldErrors?.vehicle_model?.[0]}
      />

      <Input
        id="license_plate"
        name="license_plate"
        label="License plate"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        defaultValue={plateDefault}
        key={`plate-${initialVehicle.license_plate ?? "empty"}`}
        disabled={disabled}
        placeholder="e.g. 12-345-67"
        hint="Digits only; separators are fine."
        error={state?.fieldErrors?.license_plate?.[0]}
      />
    </>
  );
}
