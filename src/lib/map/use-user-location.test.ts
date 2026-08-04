import { describe, expect, it } from "vitest";

import { geolocationErrorCodeToReason } from "@/lib/map/use-user-location";

describe("use-user-location helpers", () => {
  it("maps geolocation error codes to stable reasons", () => {
    expect(geolocationErrorCodeToReason(1)).toBe("denied");
    expect(geolocationErrorCodeToReason(2)).toBe("unavailable");
    expect(geolocationErrorCodeToReason(3)).toBe("timeout");
    expect(geolocationErrorCodeToReason(999)).toBe("unsupported");
  });
});

