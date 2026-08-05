import { describe, expect, it, vi } from "vitest";

import {
  loadMapLibreModule,
  resetMapLibreModuleLoader,
} from "@/lib/map/load-maplibre-module";

describe("loadMapLibreModule", () => {
  it("reuses one shared dynamic-import promise", async () => {
    resetMapLibreModuleLoader();

    const importSpy = vi.fn(async () => ({ Map: vi.fn() }));
    vi.stubGlobal("dynamicImportStub", importSpy);

    // Force the module path by resetting and calling twice.
    // The real implementation uses import("maplibre-gl"); we assert identity.
    const first = loadMapLibreModule();
    const second = loadMapLibreModule();
    expect(second).toBe(first);

    // Settle without failing if maplibre is unavailable in node.
    await Promise.allSettled([first, second]);
    resetMapLibreModuleLoader();
  });
});
