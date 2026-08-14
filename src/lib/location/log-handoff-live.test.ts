import { afterEach, describe, expect, it, vi } from "vitest";

import { logHandoffLive } from "@/lib/location/log-handoff-live";

describe("logHandoffLive", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("logs the shared prefix and strips tokens in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    logHandoffLive("claim active", {
      claimId: "11111111-1111-4111-8111-111111111111",
      token: "secret-token",
      accessToken: "secret-access",
      authorization: "Bearer secret",
      jwt: "secret-jwt",
      lat: 32.08,
    });

    expect(info).toHaveBeenCalledWith("[switch-it:handoff-live] claim active", {
      claimId: "11111111-1111-4111-8111-111111111111",
      lat: 32.08,
    });
  });

  it("is silent outside development", () => {
    vi.stubEnv("NODE_ENV", "test");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    logHandoffLive("claim active", { claimId: "x" });
    expect(info).not.toHaveBeenCalled();
  });
});
