import { describe, expect, it, vi } from "vitest";

import {
  LEAVER_MAP_SHELL_HEIGHT_CLASS,
  LEAVER_MAP_ZOOM_CONTROLS_MEDIA_QUERY,
  publisherPreviewShellClass,
  shouldShowLeaverMapZoomControls,
} from "@/lib/map/leaverMapShell";

describe("leaver map shell contracts", () => {
  it("uses responsive picker and preview shell class names", () => {
    expect(LEAVER_MAP_SHELL_HEIGHT_CLASS).toBe("leaver-map-picker-shell");
    expect(publisherPreviewShellClass("available")).toContain(
      "publisher-preview-map-shell--available",
    );
    expect(publisherPreviewShellClass("claimed")).toContain(
      "publisher-preview-map-shell--claimed",
    );
    expect(publisherPreviewShellClass("handoff")).toContain(
      "publisher-preview-map-shell--handoff",
    );
  });

  it("shows MapLibre zoom controls only at the Tailwind sm breakpoint and up", () => {
    expect(LEAVER_MAP_ZOOM_CONTROLS_MEDIA_QUERY).toBe("(min-width: 640px)");

    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === LEAVER_MAP_ZOOM_CONTROLS_MEDIA_QUERY,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    expect(shouldShowLeaverMapZoomControls()).toBe(true);

    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    expect(shouldShowLeaverMapZoomControls()).toBe(false);
  });
});
