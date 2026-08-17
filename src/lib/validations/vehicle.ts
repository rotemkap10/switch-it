import { z } from "zod";

import {
  isVehicleProfileComplete,
  type VehicleProfileFields,
} from "@/lib/vehicle/profile-fields";
import {
  isVehicleColor,
  type VehicleColor,
} from "@/lib/vehicle/colors";
import { normalizeLicensePlate } from "@/lib/vehicle/normalize-plate";
import { type VehicleType } from "@/lib/vehicle/types";
import {
  canonicalizeMake,
  canonicalizeModel,
  getVehicleClass,
} from "@/lib/vehicle/catalog";
import {
  MIN_VEHICLE_YEAR,
  isVehicleYear,
  maxVehicleYear,
} from "@/lib/vehicle/years";

export type VehicleProfile = {
  license_plate: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number;
  vehicle_color: VehicleColor;
  vehicle_type: VehicleType;
};

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

function parseMakeModel(
  value: string,
  path: "vehicle_make" | "vehicle_model",
  ctx: z.RefinementCtx,
) {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    ctx.addIssue({
      code: "custom",
      message: "This field is required.",
      path: [path],
    });
    return;
  }
  if (trimmed.length > 40) {
    ctx.addIssue({
      code: "custom",
      message: "Must be at most 40 characters.",
      path: [path],
    });
  }
}

function parseVehicleYear(value: string, ctx: z.RefinementCtx): number | null {
  if (isBlank(value)) {
    ctx.addIssue({
      code: "custom",
      message: "Choose a vehicle year.",
      path: ["vehicle_year"],
    });
    return null;
  }

  const trimmed = value.trim();
  if (!/^\d{4}$/.test(trimmed)) {
    ctx.addIssue({
      code: "custom",
      message: "Enter a 4-digit year.",
      path: ["vehicle_year"],
    });
    return null;
  }

  const year = Number(trimmed);
  if (!isVehicleYear(year)) {
    ctx.addIssue({
      code: "custom",
      message: `Choose a year between ${MIN_VEHICLE_YEAR} and ${maxVehicleYear()}.`,
      path: ["vehicle_year"],
    });
    return null;
  }

  return year;
}

/**
 * Vehicle updates require make, model, year, color, and plate.
 * Vehicle type is derived from the catalog and is not a user-facing field.
 * Year is required on save; existing rows may still have NULL year.
 */
export const updateVehicleSchema = z
  .object({
    license_plate: z.string(),
    vehicle_make: z.string(),
    vehicle_model: z.string(),
    vehicle_year: z.string(),
    vehicle_color: z.string(),
    vehicle_type: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const blanks = [
      isBlank(data.license_plate),
      isBlank(data.vehicle_make),
      isBlank(data.vehicle_model),
      isBlank(data.vehicle_year),
      isBlank(data.vehicle_color),
    ];
    const blankCount = blanks.filter(Boolean).length;

    if (blankCount === 5) {
      ctx.addIssue({
        code: "custom",
        message: "Complete all vehicle fields.",
        path: ["form"],
      });
      return;
    }

    if (blankCount > 0) {
      ctx.addIssue({
        code: "custom",
        message: "Complete all vehicle fields.",
        path: ["form"],
      });
    }

    if (!isBlank(data.license_plate)) {
      const plate = normalizeLicensePlate(data.license_plate);
      if (!plate.ok) {
        ctx.addIssue({
          code: "custom",
          message: plate.error,
          path: ["license_plate"],
        });
      }
    } else {
      ctx.addIssue({
        code: "custom",
        message: "License plate is required.",
        path: ["license_plate"],
      });
    }

    parseMakeModel(data.vehicle_make, "vehicle_make", ctx);
    parseMakeModel(data.vehicle_model, "vehicle_model", ctx);
    parseVehicleYear(data.vehicle_year, ctx);

    if (isBlank(data.vehicle_color) || !isVehicleColor(data.vehicle_color)) {
      ctx.addIssue({
        code: "custom",
        message: "Choose a vehicle color.",
        path: ["vehicle_color"],
      });
    }
  })
  .transform((data): VehicleProfile => {
    const plate = normalizeLicensePlate(data.license_plate);
    const year = Number(data.vehicle_year.trim());
    if (
      !plate.ok ||
      !isVehicleColor(data.vehicle_color) ||
      !isVehicleYear(year)
    ) {
      throw new Error("Vehicle validation transform received invalid data.");
    }

    const vehicleMake = canonicalizeMake(data.vehicle_make);
    const vehicleModel = canonicalizeModel(vehicleMake, data.vehicle_model);
    return {
      license_plate: plate.normalized,
      vehicle_make: vehicleMake,
      vehicle_model: vehicleModel,
      vehicle_year: year,
      vehicle_color: data.vehicle_color,
      vehicle_type: getVehicleClass(
        vehicleMake,
        vehicleModel,
        data.vehicle_type,
      ),
    };
  });

export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;

export function hasCompleteVehicleProfile(
  value: VehicleProfileFields | null | undefined,
): boolean {
  return isVehicleProfileComplete(value);
}

export { isVehicleProfileComplete };
