import { afterEach, describe, expect, it, vi } from "vitest";

const { setWorkerUrlMock } = vi.hoisted(() => ({
  setWorkerUrlMock: vi.fn(),
}));

vi.mock("maplibre-gl", () => ({
  setWorkerUrl: setWorkerUrlMock,
}));

describe("configureMapLibreWorker", () => {
  afterEach(() => {
    vi.resetModules();
    setWorkerUrlMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("sets the self-hosted worker URL once in the browser", async () => {
    vi.stubGlobal("window", {});

    const { configureMapLibreWorker } = await import(
      "@/lib/map/configure-maplibre-worker"
    );

    configureMapLibreWorker();
    configureMapLibreWorker();

    expect(setWorkerUrlMock).toHaveBeenCalledTimes(1);
    expect(setWorkerUrlMock).toHaveBeenCalledWith(
      "/maplibre/maplibre-gl-worker.mjs",
    );
  });

  it("does nothing on the server", async () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error - simulate server environment
    delete globalThis.window;

    const { configureMapLibreWorker } = await import(
      "@/lib/map/configure-maplibre-worker"
    );

    configureMapLibreWorker();

    expect(setWorkerUrlMock).not.toHaveBeenCalled();

    globalThis.window = originalWindow;
  });
});
