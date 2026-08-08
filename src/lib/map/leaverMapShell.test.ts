import { describe, expect, it } from "vitest";

import {
  LEAVER_MAP_SHELL_HEIGHT_CLASS,
  publisherPreviewShellClass,
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
});
