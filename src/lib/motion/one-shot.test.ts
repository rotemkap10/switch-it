import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  claimOneShotAnimation,
  resetOneShotAnimationsForTests,
} from "@/lib/motion/one-shot";

describe("claimOneShotAnimation", () => {
  beforeEach(() => {
    resetOneShotAnimationsForTests();
    vi.stubGlobal("sessionStorage", {
      store: new Map<string, string>(),
      getItem(key: string) {
        return this.store.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        this.store.set(key, value);
      },
    });
  });

  it("allows the first claim and rejects repeats", () => {
    expect(claimOneShotAnimation("profile-credits-entrance")).toBe(true);
    expect(claimOneShotAnimation("profile-credits-entrance")).toBe(false);
  });

  it("keeps independent semantic keys separate", () => {
    expect(claimOneShotAnimation("a")).toBe(true);
    expect(claimOneShotAnimation("b")).toBe(true);
  });
});
