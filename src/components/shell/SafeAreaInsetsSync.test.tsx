import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const syncSafeAreaInsetCssVars = vi.hoisted(() => vi.fn());

vi.mock("@/lib/native/safe-area", () => ({
  syncSafeAreaInsetCssVars,
}));

import { SafeAreaInsetsSync } from "@/components/shell/SafeAreaInsetsSync";

describe("SafeAreaInsetsSync", () => {
  afterEach(() => {
    syncSafeAreaInsetCssVars.mockReset();
  });

  it("syncs safe-area tokens on mount and listens for viewport changes", () => {
    const addListener = vi.fn();
    const removeListener = vi.fn();
    vi.stubGlobal("visualViewport", {
      addEventListener: addListener,
      removeEventListener: removeListener,
    });

    const { unmount } = render(<SafeAreaInsetsSync />);

    expect(syncSafeAreaInsetCssVars).toHaveBeenCalledTimes(1);
    expect(addListener).toHaveBeenCalledWith("resize", expect.any(Function));

    unmount();
    expect(removeListener).toHaveBeenCalledWith("resize", expect.any(Function));
  });
});
