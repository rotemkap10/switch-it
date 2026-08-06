import { describe, expect, it } from "vitest";

import { buildWazeNavigateUrl } from "@/lib/map/navigation-urls";

describe("navigation coordinate regression", () => {
  it("does not use address text in external navigation URLs", () => {
    const latitude = 32.085312;
    const longitude = 34.781812;
    const address = "Dizengoff Street 120, Tel Aviv";

    const url = buildWazeNavigateUrl(latitude, longitude);
    expect(url).toContain(`${latitude}`);
    expect(url).toContain(`${longitude}`);
    expect(url).not.toContain(encodeURIComponent(address));
    expect(url).not.toContain("Dizengoff");
  });
});
