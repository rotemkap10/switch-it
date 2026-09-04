import { afterEach, describe, expect, it, vi } from "vitest";

import {
  loadMapLibreModule,
  resetMapLibreModuleLoader,
  setMapLibreModuleImporterForTests,
} from "@/lib/map/load-maplibre-module";

describe("loadMapLibreModule", () => {
  afterEach(() => {
    setMapLibreModuleImporterForTests(null);
    resetMapLibreModuleLoader();
  });

  it("reuses one shared dynamic-import promise", async () => {
    const importSpy = vi.fn(async () => ({ Map: vi.fn() }) as never);
    setMapLibreModuleImporterForTests(importSpy);

    const first = loadMapLibreModule();
    const second = loadMapLibreModule();
    expect(second).toBe(first);
    expect(importSpy).toHaveBeenCalledTimes(1);

    await Promise.allSettled([first, second]);
  });

  it("does not cache a rejected import so a later retry can succeed", async () => {
    const importSpy = vi
      .fn()
      .mockRejectedValueOnce(
        new Error("Failed to fetch dynamically imported module"),
      )
      .mockResolvedValueOnce({ Map: vi.fn() } as never);
    setMapLibreModuleImporterForTests(importSpy);

    await expect(loadMapLibreModule()).rejects.toThrow(
      "Failed to fetch dynamically imported module",
    );
    await expect(loadMapLibreModule()).resolves.toMatchObject({
      Map: expect.any(Function),
    });
    expect(importSpy).toHaveBeenCalledTimes(2);
  });
});
