import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const isNativeMock = vi.hoisted(() => vi.fn(() => false));

vi.mock("@/lib/location/is-native-handoff-platform", () => ({
  isNativeHandoffPlatform: () => isNativeMock(),
}));

import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";

describe("ServiceWorkerRegistration", () => {
  const register = vi.fn().mockResolvedValue({ update: vi.fn() });

  beforeEach(() => {
    register.mockClear();
    isNativeMock.mockReturnValue(false);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubGlobal("navigator", {
      serviceWorker: { register },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("registers /sw.js in production browser/PWA", async () => {
    render(<ServiceWorkerRegistration />);

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
    });
  });

  it("does not register inside Capacitor native WebView", async () => {
    isNativeMock.mockReturnValue(true);
    render(<ServiceWorkerRegistration />);

    await waitFor(() => {
      expect(register).not.toHaveBeenCalled();
    });
  });

  it("does not register in development by default", async () => {
    vi.stubEnv("NODE_ENV", "development");
    render(<ServiceWorkerRegistration />);

    await waitFor(() => {
      expect(register).not.toHaveBeenCalled();
    });
  });
});
