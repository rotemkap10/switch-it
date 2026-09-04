import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RouteErrorScreen } from "@/components/shell/RouteErrorScreen";
import {
  resetStaleClientBuildRecoveryForTests,
  setStaleClientBuildReloadForTests,
} from "@/lib/navigation/stale-client-build";

describe("RouteErrorScreen", () => {
  const reload = vi.fn();

  beforeEach(() => {
    resetStaleClientBuildRecoveryForTests();
    reload.mockReset();
    setStaleClientBuildReloadForTests(reload);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("location", {
      href: "http://localhost/map",
      pathname: "/map",
      reload,
      assign: vi.fn(),
    });
  });

  afterEach(() => {
    resetStaleClientBuildRecoveryForTests();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders readable title, explanation, and actions", async () => {
    const user = userEvent.setup();
    render(<RouteErrorScreen />);

    const title = screen.getByRole("heading", {
      name: "This page couldn’t load",
    });
    expect(title).toBeInTheDocument();
    expect(title.className).toContain("offline-page__title");
    expect(
      screen.getByText(
        "Something unexpected went wrong. Reload this page or go back.",
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reload" }));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
  });

  it("auto-recovers a stale chunk error instead of showing the fatal page", () => {
    const error = new Error("Loading chunk app/map failed");
    error.name = "ChunkLoadError";
    render(<RouteErrorScreen error={error} />);

    expect(screen.getByTestId("stale-client-build-recovery")).toBeInTheDocument();
    expect(screen.queryByTestId("route-error-screen")).not.toBeInTheDocument();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("shows the fatal page for a genuine unknown error without auto-reloading", () => {
    const error = new Error("Cannot read properties of null");
    error.name = "TypeError";
    render(<RouteErrorScreen error={error} digest="abc123" />);

    expect(screen.getByTestId("route-error-screen")).toBeInTheDocument();
    expect(screen.getByTestId("route-error-digest")).toHaveTextContent("abc123");
    expect(reload).not.toHaveBeenCalled();
  });

  it("does not auto-reload a second stale error in the same tab", () => {
    const error = new Error("Failed to fetch dynamically imported module");
    error.name = "ChunkLoadError";
    const first = render(<RouteErrorScreen error={error} />);
    expect(reload).toHaveBeenCalledTimes(1);
    first.unmount();

    reload.mockReset();
    render(<RouteErrorScreen error={error} />);
    expect(screen.getByTestId("route-error-screen")).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
  });
});
