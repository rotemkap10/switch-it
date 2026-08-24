import { describe, expect, it } from "vitest";

import {
  isAppMode,
  MODE_HOME,
  MODE_LABELS,
  MODE_STORAGE_PREFIX,
  modeFromPathname,
  modeStorageKey,
  modeSwitchSelection,
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
    expect(modeFromPathname("/map/preview")).toBe("seeker");
    expect(modeFromPathname("/spots/new")).toBe("leaver");
    expect(modeFromPathname("/spots/new/preview")).toBe("leaver");
    expect(modeFromPathname("/profile")).toBeNull();
    expect(modeFromPathname("/profile/vehicle")).toBeNull();
    expect(modeFromPathname("/history")).toBeNull();
    expect(modeFromPathname("/history/item")).toBeNull();
    expect(modeFromPathname("/help")).toBeNull();
    expect(modeFromPathname("/help/safety")).toBeNull();
  });

  it("selects a mode-switch tab only on primary map routes", () => {
    expect(modeSwitchSelection("/map")).toBe("seeker");
    expect(modeSwitchSelection("/spots/new")).toBe("leaver");
    expect(modeSwitchSelection("/profile")).toBeNull();
    expect(modeSwitchSelection("/history")).toBeNull();
    expect(modeSwitchSelection("/help")).toBeNull();
    expect(modeSwitchSelection("/profile/vehicle")).toBeNull();
    expect(modeSwitchSelection("/profile", "seeker")).toBe("seeker");
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
