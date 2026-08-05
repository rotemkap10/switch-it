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
 * Vehicle updates require a fully complete profile.
 * Clearing all fields is not allowed after onboarding.
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
  .transform((data): VehicleProfile => {
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

export function hasCompleteVehicleProfile(
  value: VehicleProfileFields | null | undefined,
): boolean {
  return isVehicleProfileComplete(value);
}

export { isVehicleProfileComplete };
