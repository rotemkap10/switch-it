import { describe, expect, it, vi } from "vitest";

import { prepareFindParkingAfterHandoff } from "@/lib/handoff/prepare-find-parking-after-handoff";

describe("prepareFindParkingAfterHandoff", () => {
  it("refreshes without replacing when already on /map", () => {
    const replace = vi.fn();
    const refresh = vi.fn();
    const prefetch = vi.fn();

    expect(
      prepareFindParkingAfterHandoff("/map", { replace, refresh, prefetch }),
    ).toBe("refresh");
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
    expect(prefetch).not.toHaveBeenCalled();
  });

  it("prefetches and replaces from a non-map route without an extra refresh", () => {
    const replace = vi.fn();
    const refresh = vi.fn();
    const prefetch = vi.fn();

    expect(
      prepareFindParkingAfterHandoff("/spots/new", {
        replace,
        refresh,
        prefetch,
      }),
    ).toBe("replace");
    expect(prefetch).toHaveBeenCalledWith("/map");
    expect(replace).toHaveBeenCalledWith("/map");
    expect(refresh).not.toHaveBeenCalled();
  });
});
