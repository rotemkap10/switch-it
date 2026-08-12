import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { SensoryPreferences } from "@/components/profile/SensoryPreferences";
import {
  readSensoryPreferences,
  SENSORY_PREFS_STORAGE_KEY,
} from "@/lib/sensory/preferences";

describe("SensoryPreferences", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults both switches on", () => {
    render(<SensoryPreferences />);
    expect(screen.getByRole("switch", { name: "Sounds" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("switch", { name: "Haptics" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("persists sounds off in localStorage", async () => {
    const user = userEvent.setup();
    render(<SensoryPreferences />);
    await user.click(screen.getByRole("switch", { name: "Sounds" }));
    expect(screen.getByRole("switch", { name: "Sounds" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(readSensoryPreferences()).toEqual({ sounds: false, haptics: true });
    expect(window.localStorage.getItem(SENSORY_PREFS_STORAGE_KEY)).toContain(
      '"sounds":false',
    );
  });
});
