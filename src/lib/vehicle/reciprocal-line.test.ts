import { describe, expect, it } from "vitest";

import { formatOwnVehicleReciprocalLine } from "@/lib/vehicle/reciprocal-line";
import type { HandoffVehicle } from "@/lib/vehicle/handoff-vehicle";

const complete: HandoffVehicle = {
  licensePlate: "1234567",
  make: "Hyundai",
  model: "Tucson",
  color: "white",
  type: "suv",
};

describe("formatOwnVehicleReciprocalLine", () => {
  it("builds the reciprocal recognition line", () => {
    expect(formatOwnVehicleReciprocalLine(complete)).toBe(
      "They are looking for your White Hyundai Tucson, plate 12-345-67.",
    );
  });

  it("returns null for incomplete vehicles", () => {
    expect(
      formatOwnVehicleReciprocalLine({
        ...complete,
        make: null,
      }),
    ).toBeNull();
  });
});
