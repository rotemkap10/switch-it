import { beforeEach, describe, expect, it, vi } from "vitest";

const getRTLTextPluginStatus = vi.fn();
const setRTLTextPlugin = vi.fn(() => Promise.resolve());

vi.mock("maplibre-gl", () => ({
  getRTLTextPluginStatus: (...args: unknown[]) =>
    getRTLTextPluginStatus(...args),
  setRTLTextPlugin: (...args: unknown[]) => setRTLTextPlugin(...args),
}));

describe("configureMapLibreRtlPlugin", () => {
  beforeEach(() => {
    vi.resetModules();
    getRTLTextPluginStatus.mockReset();
    setRTLTextPlugin.mockReset();
    setRTLTextPlugin.mockResolvedValue(undefined);
  });

  it("registers the self-hosted plugin when unavailable", async () => {
    getRTLTextPluginStatus.mockReturnValue("unavailable");
    const { configureMapLibreRtlPlugin, MAPLIBRE_RTL_PLUGIN_URL } =
      await import("@/lib/map/configure-maplibre-rtl");

    configureMapLibreRtlPlugin();

    expect(setRTLTextPlugin).toHaveBeenCalledWith(MAPLIBRE_RTL_PLUGIN_URL, true);
  });

  it("does not re-register when the plugin is already deferred/loaded", async () => {
    getRTLTextPluginStatus.mockReturnValue("deferred");
    const { configureMapLibreRtlPlugin } = await import(
      "@/lib/map/configure-maplibre-rtl"
    );

    configureMapLibreRtlPlugin();

    expect(setRTLTextPlugin).not.toHaveBeenCalled();
  });
});
