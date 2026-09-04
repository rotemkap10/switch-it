import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  canRecoverFromStaleClientBuild,
  installStaleClientBuildListeners,
  isStaleClientBuildError,
  recoverFromStaleClientBuildOnce,
  resetStaleClientBuildRecoveryForTests,
  sanitizeClientErrorText,
  setStaleClientBuildReloadForTests,
  STALE_CLIENT_BUILD_RECOVERY_KEY,
} from "@/lib/navigation/stale-client-build";

describe("stale client build recovery", () => {
  const reload = vi.fn();

  beforeEach(() => {
    resetStaleClientBuildRecoveryForTests();
    reload.mockReset();
    setStaleClientBuildReloadForTests(reload);
  });

  afterEach(() => {
    resetStaleClientBuildRecoveryForTests();
  });

  it("detects webpack ChunkLoadError and dynamic import failures", () => {
    const chunk = new Error(
      "Loading chunk app/map failed.\n(error: https://example.com/_next/static/chunks/map.js)",
    );
    chunk.name = "ChunkLoadError";
    expect(isStaleClientBuildError(chunk)).toBe(true);

    expect(
      isStaleClientBuildError(
        new Error(
          "Failed to fetch dynamically imported module: https://example.com/_next/static/chunks/app.js",
        ),
      ),
    ).toBe(true);

    expect(
      isStaleClientBuildError(new Error("Failed to fetch RSC payload for /map")),
    ).toBe(true);
  });

  it("does not treat unrelated exceptions as stale builds", () => {
    expect(
      isStaleClientBuildError(new TypeError("Cannot read properties of null")),
    ).toBe(false);
    expect(isStaleClientBuildError(new Error("NEXT_REDIRECT"))).toBe(false);
    expect(isStaleClientBuildError(new Error("Invalid plate digits"))).toBe(
      false,
    );
    expect(isStaleClientBuildError(new Error("Failed to fetch"))).toBe(false);
  });

  it("triggers one recovery reload and then refuses to loop", () => {
    const chunk = new Error("Loading chunk 123 failed");
    chunk.name = "ChunkLoadError";
    expect(isStaleClientBuildError(chunk)).toBe(true);
    expect(canRecoverFromStaleClientBuild()).toBe(true);

    expect(recoverFromStaleClientBuildOnce()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(STALE_CLIENT_BUILD_RECOVERY_KEY)).toBe(
      "attempted",
    );

    expect(canRecoverFromStaleClientBuild()).toBe(false);
    expect(recoverFromStaleClientBuildOnce()).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does not auto-reload an unrelated exception", () => {
    expect(isStaleClientBuildError(new Error("boom"))).toBe(false);
    const unsub = installStaleClientBuildListeners();
    window.dispatchEvent(new ErrorEvent("error", { error: new Error("boom") }));
    expect(reload).not.toHaveBeenCalled();
    unsub();
  });

  it("recovers from unhandled ChunkLoadError rejections once", () => {
    const chunk = new Error("Failed to fetch dynamically imported module");
    chunk.name = "ChunkLoadError";
    const unsub = installStaleClientBuildListeners();
    window.dispatchEvent(
      new PromiseRejectionEvent("unhandledrejection", {
        reason: chunk,
        promise: Promise.resolve(),
      }),
    );
    expect(reload).toHaveBeenCalledTimes(1);
    window.dispatchEvent(
      new PromiseRejectionEvent("unhandledrejection", {
        reason: chunk,
        promise: Promise.resolve(),
      }),
    );
    expect(reload).toHaveBeenCalledTimes(1);
    unsub();
  });

  it("strips query strings from diagnostic URLs", () => {
    expect(
      sanitizeClientErrorText(
        "Failed https://app.example/_next/static/chunk.js?token=secret-value",
      ),
    ).toBe("Failed https://app.example/_next/static/chunk.js");
  });
});

describe("stale client build wiring", () => {
  it("installs recovery listeners from the authenticated app shell", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/feedback/AppFeedbackRoot.tsx"),
      "utf8",
    );
    expect(source).toContain("installStaleClientBuildListeners");
  });

  it("routes Next.js error boundaries through RouteErrorScreen with the error object", () => {
    const appError = readFileSync(
      resolve(process.cwd(), "src/app/error.tsx"),
      "utf8",
    );
    const globalError = readFileSync(
      resolve(process.cwd(), "src/app/global-error.tsx"),
      "utf8",
    );
    expect(appError).toContain("RouteErrorScreen");
    expect(appError).toContain("error={error}");
    expect(globalError).toContain("RouteErrorScreen");
    expect(globalError).toContain("error={error}");
    expect(appError).not.toContain("reset()");
    expect(globalError).not.toContain("reset()");
  });
});
