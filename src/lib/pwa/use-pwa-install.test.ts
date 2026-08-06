import { renderHook, act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BeforeInstallPromptEvent } from "@/lib/pwa/install-state";
import { usePwaInstall } from "@/lib/pwa/use-pwa-install";

describe("usePwaInstall", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      media: "",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Linux; Android 14)",
      maxTouchPoints: 1,
      standalone: false,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("captures beforeinstallprompt and prompts only after user action", async () => {
    const prompt = vi.fn().mockResolvedValue(undefined);
    const userChoice = Promise.resolve({ outcome: "accepted" as const });

    const { result } = renderHook(() => usePwaInstall());

    await waitFor(() => {
      expect(result.current.capability).not.toBe("unknown");
    });

    act(() => {
      const event = new Event("beforeinstallprompt", {
        cancelable: true,
      }) as BeforeInstallPromptEvent;
      event.preventDefault = vi.fn();
      event.prompt = prompt;
      event.userChoice = userChoice;
      window.dispatchEvent(event);
    });

    await waitFor(() => {
      expect(result.current.showInstallEntry).toBe(true);
    });

    await act(async () => {
      await result.current.requestInstallUi();
    });

    expect(prompt).toHaveBeenCalledTimes(1);
  });
});
