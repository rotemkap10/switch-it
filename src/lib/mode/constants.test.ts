import { describe, expect, it } from "vitest";

import {
  isAppMode,
  MODE_HOME,
  MODE_LABELS,
  MODE_STORAGE_PREFIX,
  modeFromPathname,
  modeStorageKey,
} from "@/lib/mode/constants";

describe("mode constants helpers", () => {
  it("builds a per-user storage key", () => {
    expect(modeStorageKey("user-123")).toBe(
      `${MODE_STORAGE_PREFIX}user-123`,
    );
    expect(modeStorageKey("user-a")).not.toBe(modeStorageKey("user-b"));
  });

  it("exposes mode home routes and canonical labels", () => {
    expect(MODE_HOME.seeker).toBe("/map");
    expect(MODE_HOME.leaver).toBe("/spots/new");
    expect(MODE_LABELS.seeker).toBe("Find parking");
    expect(MODE_LABELS.leaver).toBe("Share a spot");
  });

  it("derives mode from the pathname", () => {
    expect(modeFromPathname("/map")).toBe("seeker");
    expect(modeFromPathname("/spots/new")).toBe("leaver");
    expect(modeFromPathname("/profile")).toBeNull();
    expect(modeFromPathname("/help")).toBeNull();
  });

  it("recognizes valid app modes only", () => {
    expect(isAppMode("seeker")).toBe(true);
    expect(isAppMode("leaver")).toBe(true);
    expect(isAppMode("admin")).toBe(false);
    expect(isAppMode("")).toBe(false);
    expect(isAppMode(null)).toBe(false);
    expect(isAppMode(undefined)).toBe(false);
  });
});
