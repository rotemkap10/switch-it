import { describe, expect, it } from "vitest";

import { displayNameInitial } from "@/components/illustrations/UserInitialAvatar";

describe("displayNameInitial", () => {
  it("uses the first character uppercased", () => {
    expect(displayNameInitial("alex")).toBe("A");
    expect(displayNameInitial("  Jordan ")).toBe("J");
  });

  it("falls back when empty", () => {
    expect(displayNameInitial(null)).toBe("?");
    expect(displayNameInitial("   ")).toBe("?");
  });
});
