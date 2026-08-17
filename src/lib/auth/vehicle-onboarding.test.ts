import { describe, expect, it } from "vitest";

import { resolvePostAuthRedirect } from "@/lib/auth/post-auth-redirect";
import type { AuthenticatedVehicleStatus } from "@/lib/auth/vehicle-status";
import { isVehicleProfileComplete } from "@/lib/vehicle/profile-fields";

const completeVehicle = {
  license_plate: "1234567",
  vehicle_make: "Hyundai",
  vehicle_model: "Tucson",
  vehicle_color: "white",
  vehicle_type: "suv",
};

function status(
  overrides: Partial<AuthenticatedVehicleStatus>,
): AuthenticatedVehicleStatus {
  return {
    vehicle: null,
    vehicleComplete: false,
    hasActiveSeekerClaim: false,
    hasActivePublisherSpot: false,
    hasActiveHandoff: false,
    ...overrides,
  };
}

describe("isVehicleProfileComplete", () => {
  it("returns true for a complete profile", () => {
    expect(isVehicleProfileComplete(completeVehicle)).toBe(true);
    expect(
      isVehicleProfileComplete({
        ...completeVehicle,
        vehicle_year: null,
      }),
    ).toBe(true);
    expect(
      isVehicleProfileComplete({
        ...completeVehicle,
        vehicle_photo_path: null,
      }),
    ).toBe(true);
  });

  it("does not require a vehicle photo", () => {
    expect(
      isVehicleProfileComplete({
        license_plate: null,
        vehicle_make: null,
        vehicle_model: null,
        vehicle_color: null,
        vehicle_type: null,
        vehicle_photo_path: "user/photo.jpg",
      }),
    ).toBe(false);
  });

  it("returns false when any field is missing", () => {
    expect(
      isVehicleProfileComplete({ ...completeVehicle, license_plate: null }),
    ).toBe(false);
    expect(
      isVehicleProfileComplete({ ...completeVehicle, vehicle_make: "" }),
    ).toBe(false);
    expect(
      isVehicleProfileComplete({ ...completeVehicle, vehicle_model: "  " }),
    ).toBe(false);
    expect(
      isVehicleProfileComplete({ ...completeVehicle, vehicle_color: "magenta" }),
    ).toBe(false);
    expect(
      isVehicleProfileComplete({ ...completeVehicle, vehicle_type: "coupe" }),
    ).toBe(false);
  });
});

describe("resolvePostAuthRedirect", () => {
  it("sends complete users to the safe next path", () => {
    expect(
      resolvePostAuthRedirect(
        status({ vehicleComplete: true, vehicle: completeVehicle }),
        "/history",
      ),
    ).toBe("/history");
  });

  it("sends incomplete users to onboarding by default", () => {
    expect(resolvePostAuthRedirect(status({}), "/map")).toBe(
      "/onboarding/vehicle",
    );
  });

  it("routes incomplete users with an active seeker claim to the map", () => {
    expect(
      resolvePostAuthRedirect(
        status({ hasActiveSeekerClaim: true, hasActiveHandoff: true }),
        "/map",
      ),
    ).toBe("/map");
  });

  it("routes incomplete users with an active publisher spot to spots/new", () => {
    expect(
      resolvePostAuthRedirect(
        status({ hasActivePublisherSpot: true, hasActiveHandoff: true }),
        "/map",
      ),
    ).toBe("/spots/new");
  });
});
