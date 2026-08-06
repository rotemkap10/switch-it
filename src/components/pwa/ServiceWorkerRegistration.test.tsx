import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";

describe("ServiceWorkerRegistration", () => {
  const register = vi.fn().mockResolvedValue({ update: vi.fn() });

  beforeEach(() => {
    register.mockClear();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubGlobal("navigator", {
      serviceWorker: { register },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("registers /sw.js in production", async () => {
    render(<ServiceWorkerRegistration />);

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
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
