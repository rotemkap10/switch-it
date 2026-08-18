"use client";

import { useMemo, useState } from "react";

import { VehicleImage } from "@/components/vehicle/VehicleImage";
import { VehicleMakeModelFields } from "@/components/vehicle/VehicleMakeModelFields";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  canonicalizeMake,
  canonicalizeModel,
  getVehicleClass,
} from "@/lib/vehicle/catalog";
import {
  VEHICLE_COLOR_LABELS,
  VEHICLE_COLORS,
  isVehicleColor,
  type VehicleColor,
} from "@/lib/vehicle/colors";
import { formatLicensePlateForDisplay } from "@/lib/vehicle/normalize-plate";
import type { VehicleProfileFields } from "@/lib/vehicle/profile-fields";
import {
  coerceVehicleYear,
  formatMakeModelYear,
  vehicleYearSelectOptions,
} from "@/lib/vehicle/years";

export type VehicleFieldsState = {
  fieldErrors?: Record<string, string[]>;
};

type VehicleFieldsProps = {
  initialVehicle: VehicleProfileFields;
  disabled?: boolean;
  showSummary?: boolean;
  showPreview?: boolean;
  /** Show a neutral hero illustration before type/color are chosen. */
  placeholderPreview?: boolean;
  /** Size for the live type/color preview illustration. */
  previewSize?: "default" | "compact" | "hero";
  /** Short nudge when opening the editor (not a full drive-in). */
  previewEmphasis?: boolean;
  state?: VehicleFieldsState;
};

export function VehicleFields({
  initialVehicle,
  disabled = false,
  showSummary = false,
  showPreview = true,
  placeholderPreview = false,
  previewSize = "default",
  previewEmphasis = false,
  state,
}: VehicleFieldsProps) {
  const [vehicleColor, setVehicleColor] = useState(
    () =>
      (isVehicleColor(initialVehicle.vehicle_color ?? "")
        ? initialVehicle.vehicle_color
        : "") as string,
  );
  const [vehicleMake, setVehicleMake] = useState(() =>
    canonicalizeMake(initialVehicle.vehicle_make ?? ""),
  );
  const [vehicleModel, setVehicleModel] = useState(() =>
    canonicalizeModel(
      canonicalizeMake(initialVehicle.vehicle_make ?? ""),
      initialVehicle.vehicle_model ?? "",
    ),
  );
  const [vehicleYear, setVehicleYear] = useState(() => {
    const year = coerceVehicleYear(initialVehicle.vehicle_year);
    return year != null ? String(year) : "";
  });

  const previewColor: VehicleColor | null = isVehicleColor(vehicleColor)
    ? vehicleColor
    : null;
  const previewType = getVehicleClass(
    vehicleMake,
    vehicleModel,
    initialVehicle.vehicle_type,
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

  const yearOptions = useMemo(
    () => [
      { value: "", label: "Select year", disabled: true },
      ...vehicleYearSelectOptions(),
    ],
    [],
  );

  const plateDefault =
    initialVehicle.license_plate != null && initialVehicle.license_plate !== ""
      ? formatLicensePlateForDisplay(initialVehicle.license_plate)
      : "";

  return (
    <>
      {showPreview ? (
        <div className="vehicle-illustration-shell">
          <VehicleImage
            vehicleType={previewType}
            vehicleColor={previewColor}
            make={vehicleMake}
            model={vehicleModel}
            year={vehicleYear || null}
            placeholderPreview={placeholderPreview}
            size={previewSize}
            animate={false}
            className={previewEmphasis ? "motion-vehicle-preview-nudge" : ""}
            label={
              previewColor
                ? VEHICLE_COLOR_LABELS[previewColor]
                : "Vehicle preview"
            }
          />
        </div>
      ) : null}

      {showSummary &&
      initialVehicle.license_plate &&
      isVehicleColor(initialVehicle.vehicle_color ?? "") ? (
        <p className="text-sm text-foreground" data-testid="vehicle-summary">
          {VEHICLE_COLOR_LABELS[initialVehicle.vehicle_color as VehicleColor]}
          <span className="mt-0.5 block text-muted">
            {formatMakeModelYear(
              initialVehicle.vehicle_make ?? "",
              initialVehicle.vehicle_model ?? "",
              initialVehicle.vehicle_year,
            )}
          </span>
          <span className="mt-0.5 block font-semibold tracking-wide">
            {formatLicensePlateForDisplay(initialVehicle.license_plate)}
          </span>
        </p>
      ) : null}

      <input
        type="hidden"
        name="vehicle_type"
        value={initialVehicle.vehicle_type ?? ""}
      />

      <VehicleMakeModelFields
        make={vehicleMake}
        model={vehicleModel}
        onChange={({ make, model }) => {
          setVehicleMake(make);
          setVehicleModel(model);
        }}
        disabled={disabled}
        makeError={state?.fieldErrors?.vehicle_make?.[0]}
        modelError={state?.fieldErrors?.vehicle_model?.[0]}
      />

      <Select
        id="vehicle_year"
        name="vehicle_year"
        label="Vehicle year"
        options={yearOptions}
        value={vehicleYear}
        onChange={(event) => setVehicleYear(event.target.value)}
        disabled={disabled}
        error={state?.fieldErrors?.vehicle_year?.[0]}
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
