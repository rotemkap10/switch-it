import { describe, expect, it } from "vitest";

import {
  hasCompleteVehicleProfile,
  updateVehicleSchema,
} from "@/lib/validations/vehicle";

const validVehicle = {
  license_plate: "12-345-67",
  vehicle_make: "Hyundai",
  vehicle_model: "Tucson",
  vehicle_year: "2025",
  vehicle_color: "white",
  vehicle_type: "suv",
};

describe("updateVehicleSchema", () => {
  it("accepts a fully valid vehicle and canonicalizes plate/make/model", () => {
    const result = updateVehicleSchema.safeParse({
      ...validVehicle,
      vehicle_make: "  toyota  ",
      vehicle_model: "  corolla  ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        license_plate: "1234567",
        vehicle_make: "Toyota",
        vehicle_model: "Corolla",
        vehicle_year: 2025,
        vehicle_color: "white",
        vehicle_type: "sedan",
      });
    }
  });

  it("rejects a fully empty vehicle", () => {
    const result = updateVehicleSchema.safeParse({
      license_plate: "",
      vehicle_make: "",
      vehicle_model: "",
      vehicle_year: "",
      vehicle_color: "",
      vehicle_type: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path[0] === "form"),
      ).toBe(true);
    }
  });

  it("rejects whitespace-only fields as empty", () => {
    const result = updateVehicleSchema.safeParse({
      license_plate: "   ",
      vehicle_make: "  ",
      vehicle_model: "\t",
      vehicle_year: " ",
      vehicle_color: " ",
      vehicle_type: " ",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a partially completed vehicle", () => {
    const result = updateVehicleSchema.safeParse({
      ...validVehicle,
      vehicle_model: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path[0] === "form"),
      ).toBe(true);
    }
  });

  it("does not require vehicle type and derives it from the catalog", () => {
    const withoutType = updateVehicleSchema.safeParse({
      license_plate: "12-345-67",
      vehicle_make: "Toyota",
      vehicle_model: "Corolla",
      vehicle_year: "2025",
      vehicle_color: "white",
    });

    expect(withoutType.success).toBe(true);
    if (withoutType.success) {
      expect(withoutType.data.vehicle_type).toBe("sedan");
    }

    const tucson = updateVehicleSchema.safeParse({
      ...validVehicle,
      vehicle_type: "",
    });
    expect(tucson.success).toBe(true);
    if (tucson.success) {
      expect(tucson.data.vehicle_type).toBe("suv");
    }

    const picanto = updateVehicleSchema.safeParse({
      ...validVehicle,
      vehicle_make: "Kia",
      vehicle_model: "Picanto",
    });
    expect(picanto.success).toBe(true);
    if (picanto.success) {
      expect(picanto.data.vehicle_type).toBe("hatchback");
    }
  });

  it("keeps a legacy vehicle type only when the model is not in the catalog", () => {
    const result = updateVehicleSchema.safeParse({
      ...validVehicle,
      vehicle_make: "Koenigsegg",
      vehicle_model: "Jesko",
      vehicle_type: "sedan",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.vehicle_type).toBe("sedan");
    }

    const unknown = updateVehicleSchema.safeParse({
      ...validVehicle,
      vehicle_make: "Koenigsegg",
      vehicle_model: "Jesko",
      vehicle_type: "coupe",
    });
    expect(unknown.success).toBe(true);
    if (unknown.success) {
      expect(unknown.data.vehicle_type).toBe("other");
    }
  });

  it("rejects invalid vehicle color", () => {
    const result = updateVehicleSchema.safeParse({
      ...validVehicle,
      vehicle_color: "#ff0000",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path[0] === "vehicle_color"),
      ).toBe(true);
    }
  });

  it("rejects make/model over 40 characters", () => {
    expect(
      updateVehicleSchema.safeParse({
        ...validVehicle,
        vehicle_make: "a".repeat(41),
      }).success,
    ).toBe(false);

    expect(
      updateVehicleSchema.safeParse({
        ...validVehicle,
        vehicle_model: "b".repeat(41),
      }).success,
    ).toBe(false);
  });

  it("accepts make/model at 40 characters", () => {
    const result = updateVehicleSchema.safeParse({
      ...validVehicle,
      vehicle_make: "a".repeat(40),
      vehicle_model: "b".repeat(40),
    });

    expect(result.success).toBe(true);
  });

  it("preserves unknown make/model text when there is no catalog match", () => {
    const result = updateVehicleSchema.safeParse({
      ...validVehicle,
      vehicle_make: "Koenigsegg",
      vehicle_model: "Jesko",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.vehicle_make).toBe("Koenigsegg");
      expect(result.data.vehicle_model).toBe("Jesko");
    }
  });

  it("does not rewrite a typo to a nearby catalog model", () => {
    const result = updateVehicleSchema.safeParse({
      ...validVehicle,
      vehicle_make: "Toyota",
      vehicle_model: "corola",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.vehicle_make).toBe("Toyota");
      expect(result.data.vehicle_model).toBe("corola");
    }
  });

  it("accepts normalized 5–8 digit license plates and separator input", () => {
    for (const plate of ["12345", "123456", "1234567", "12345678"]) {
      const result = updateVehicleSchema.safeParse({
        ...validVehicle,
        license_plate: plate,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.license_plate).toBe(plate);
      }
    }

    const separated = updateVehicleSchema.safeParse({
      ...validVehicle,
      license_plate: "12-345-67",
    });
    expect(separated.success).toBe(true);
    if (separated.success) {
      expect(separated.data.license_plate).toBe("1234567");
    }
  });

  it("rejects invalid license plates", () => {
    expect(
      updateVehicleSchema.safeParse({
        ...validVehicle,
        license_plate: "12-AB",
      }).success,
    ).toBe(false);

    expect(
      updateVehicleSchema.safeParse({
        ...validVehicle,
        license_plate: "1234",
      }).success,
    ).toBe(false);

    expect(
      updateVehicleSchema.safeParse({
        ...validVehicle,
        license_plate: "123456789",
      }).success,
    ).toBe(false);

    expect(
      updateVehicleSchema.safeParse({
        ...validVehicle,
        license_plate: "ABCDE",
      }).success,
    ).toBe(false);
  });

  it("accepts 1990 through next model year", () => {
    expect(
      updateVehicleSchema.safeParse({
        ...validVehicle,
        vehicle_year: "1990",
      }).success,
    ).toBe(true);

    const nextModelYear = String(new Date().getFullYear() + 1);
    const result = updateVehicleSchema.safeParse({
      ...validVehicle,
      vehicle_year: nextModelYear,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.vehicle_year).toBe(Number(nextModelYear));
    }
  });

  it("rejects missing, non-integer, and out-of-range years", () => {
    expect(
      updateVehicleSchema.safeParse({
        ...validVehicle,
        vehicle_year: "",
      }).success,
    ).toBe(false);

    expect(
      updateVehicleSchema.safeParse({
        ...validVehicle,
        vehicle_year: "2025.5",
      }).success,
    ).toBe(false);

    expect(
      updateVehicleSchema.safeParse({
        ...validVehicle,
        vehicle_year: "1989",
      }).success,
    ).toBe(false);

    expect(
      updateVehicleSchema.safeParse({
        ...validVehicle,
        vehicle_year: String(new Date().getFullYear() + 2),
      }).success,
    ).toBe(false);
  });
});

describe("hasCompleteVehicleProfile", () => {
  it("returns true only when all vehicle fields are present and valid", () => {
    expect(
      hasCompleteVehicleProfile({
        license_plate: "1234567",
        vehicle_make: "Hyundai",
        vehicle_model: "Tucson",
        vehicle_year: null,
        vehicle_color: "white",
        vehicle_type: null,
      }),
    ).toBe(true);

    expect(
      hasCompleteVehicleProfile({
        license_plate: "1234567",
        vehicle_make: "Hyundai",
        vehicle_model: "Tucson",
        vehicle_year: 2025,
        vehicle_color: "white",
        vehicle_type: "suv",
      }),
    ).toBe(true);

    expect(
      hasCompleteVehicleProfile({
        license_plate: null,
        vehicle_make: null,
        vehicle_model: null,
        vehicle_color: null,
        vehicle_type: null,
      }),
    ).toBe(false);

    expect(
      hasCompleteVehicleProfile({
        license_plate: "1234567",
        vehicle_make: "Hyundai",
        vehicle_model: null,
        vehicle_color: "white",
        vehicle_type: "suv",
      }),
    ).toBe(false);
  });
});
