import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const syncSafeAreaInsetCssVars = vi.hoisted(() => vi.fn());
const configureNativeStatusBar = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("@/lib/native/safe-area", () => ({
  syncSafeAreaInsetCssVars,
}));

vi.mock("@/lib/native/status-bar", () => ({
  configureNativeStatusBar,
}));

import { SafeAreaInsetsSync } from "@/components/shell/SafeAreaInsetsSync";

describe("SafeAreaInsetsSync", () => {
  afterEach(() => {
    syncSafeAreaInsetCssVars.mockReset();
    configureNativeStatusBar.mockReset();
  });

  it("syncs safe-area tokens on mount and listens for viewport changes", async () => {
    const addListener = vi.fn();
    const removeListener = vi.fn();
    vi.stubGlobal("visualViewport", {
      addEventListener: addListener,
      removeEventListener: removeListener,
    });

    const { unmount } = render(<SafeAreaInsetsSync />);

    expect(syncSafeAreaInsetCssVars).toHaveBeenCalled();
    expect(configureNativeStatusBar).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(syncSafeAreaInsetCssVars.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
    expect(addListener).toHaveBeenCalledWith("resize", expect.any(Function));

    unmount();
    expect(removeListener).toHaveBeenCalledWith("resize", expect.any(Function));
  });
});
