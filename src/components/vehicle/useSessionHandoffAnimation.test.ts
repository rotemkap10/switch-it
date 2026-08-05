import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSessionHandoffAnimation, resetSessionHandoffAnimationForTests } from "@/components/vehicle/useSessionHandoffAnimation";

const sessionStore = new Map<string, string>();

describe("useSessionHandoffAnimation", () => {
  beforeEach(() => {
    sessionStore.clear();
    resetSessionHandoffAnimationForTests();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => sessionStore.get(key) ?? null,
      setItem: (key: string, value: string) => {
        sessionStore.set(key, value);
      },
      removeItem: (key: string) => {
        sessionStore.delete(key);
      },
      clear: () => {
        sessionStore.clear();
      },
      key: () => null,
      length: 0,
    });
  });

  it("returns true only on the first call for a key", () => {
    const first = renderHook(() => useSessionHandoffAnimation("claim-1"));
    expect(first.result.current).toBe(true);

    const second = renderHook(() => useSessionHandoffAnimation("claim-1"));
    expect(second.result.current).toBe(false);
  });

  it("returns false when the key is null", () => {
    const { result } = renderHook(() => useSessionHandoffAnimation(null));
    expect(result.current).toBe(false);
  });
});
