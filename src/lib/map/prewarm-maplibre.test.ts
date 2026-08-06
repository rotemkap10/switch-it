import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  hasPrewarmedMapLibre,
  prewarmMapLibre,
  resetMapLibrePrewarmState,
} from "@/lib/map/prewarm-maplibre";
import { resetMapLibreModuleLoader } from "@/lib/map/load-maplibre-module";

const prewarm = vi.fn();
const setWorkerUrl = vi.fn();

vi.mock("@/lib/map/load-maplibre-module", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/map/load-maplibre-module")
  >("@/lib/map/load-maplibre-module");
  return {
    ...actual,
    loadMapLibreModule: vi.fn(async () => ({
      prewarm,
      Map: vi.fn(() => {
        throw new Error("Map must not be constructed during prewarm");
      }),
    })),
  };
});

vi.mock("@/lib/map/configure-maplibre-worker", () => ({
  configureMapLibreWorker: () => {
    setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
  },
}));

describe("prewarmMapLibre", () => {
  beforeEach(() => {
    resetMapLibrePrewarmState();
    resetMapLibreModuleLoader();
    prewarm.mockClear();
    setWorkerUrl.mockClear();
  });

  it("calls prewarm at most once and does not create a Map", async () => {
    await prewarmMapLibre();
    await prewarmMapLibre();

    expect(prewarm).toHaveBeenCalledTimes(1);
    expect(setWorkerUrl).toHaveBeenCalledTimes(1);
    expect(hasPrewarmedMapLibre()).toBe(true);
  });
});
