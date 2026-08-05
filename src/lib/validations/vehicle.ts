import { z } from "zod";

import {
  isVehicleColor,
  type VehicleColor,
} from "@/lib/vehicle/colors";
import { normalizeLicensePlate } from "@/lib/vehicle/normalize-plate";
import {
  isVehicleType,
  type VehicleType,
} from "@/lib/vehicle/types";

export type VehicleProfile = {
  license_plate: string;
  vehicle_make: string;
  vehicle_model: string;
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

/**
 * Vehicle section is either fully empty (clear → null) or fully complete.
 * Partial payloads are rejected.
 */
export const updateVehicleSchema = z
  .object({
    license_plate: z.string(),
    vehicle_make: z.string(),
    vehicle_model: z.string(),
    vehicle_color: z.string(),
    vehicle_type: z.string(),
  })
  .superRefine((data, ctx) => {
    const blanks = [
      isBlank(data.license_plate),
      isBlank(data.vehicle_make),
      isBlank(data.vehicle_model),
      isBlank(data.vehicle_color),
      isBlank(data.vehicle_type),
    ];
    const blankCount = blanks.filter(Boolean).length;

    if (blankCount === 5) {
      return;
    }

    if (blankCount > 0) {
      ctx.addIssue({
        code: "custom",
        message: "Complete all vehicle fields, or clear them all.",
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

    if (isBlank(data.vehicle_color) || !isVehicleColor(data.vehicle_color)) {
      ctx.addIssue({
        code: "custom",
        message: "Choose a vehicle color.",
        path: ["vehicle_color"],
      });
    }

    if (isBlank(data.vehicle_type) || !isVehicleType(data.vehicle_type)) {
      ctx.addIssue({
        code: "custom",
        message: "Choose a vehicle type.",
        path: ["vehicle_type"],
      });
    }
  })
  .transform((data): VehicleProfile | null => {
    if (
      isBlank(data.license_plate) &&
      isBlank(data.vehicle_make) &&
      isBlank(data.vehicle_model) &&
      isBlank(data.vehicle_color) &&
      isBlank(data.vehicle_type)
    ) {
      return null;
    }

    const plate = normalizeLicensePlate(data.license_plate);
    if (!plate.ok || !isVehicleColor(data.vehicle_color) || !isVehicleType(data.vehicle_type)) {
      throw new Error("Vehicle validation transform received invalid data.");
    }

    return {
      license_plate: plate.normalized,
      vehicle_make: data.vehicle_make.trim(),
      vehicle_model: data.vehicle_model.trim(),
      vehicle_color: data.vehicle_color,
      vehicle_type: data.vehicle_type,
    };
  });

export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;

export function hasCompleteVehicleProfile(value: {
  license_plate: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  vehicle_type: string | null;
} | null | undefined): boolean {
  if (!value) {
    return false;
  }
  return (
    typeof value.license_plate === "string" &&
    value.license_plate.length > 0 &&
    typeof value.vehicle_make === "string" &&
    value.vehicle_make.trim().length > 0 &&
    typeof value.vehicle_model === "string" &&
    value.vehicle_model.trim().length > 0 &&
    typeof value.vehicle_color === "string" &&
    isVehicleColor(value.vehicle_color) &&
    typeof value.vehicle_type === "string" &&
    isVehicleType(value.vehicle_type)
  );
}
