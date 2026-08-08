import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MAP_SLOW_NETWORK_HINT_MS,
  MapLoadingState,
} from "@/components/map/MapLoadingState";

describe("MapLoadingState", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the primary loading copy immediately", () => {
    render(<MapLoadingState />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading the map…");
    expect(
      screen.queryByText("This may take a moment on a slow connection."),
    ).not.toBeInTheDocument();
  });

  it("reveals the slow-network hint only after the delay", () => {
    render(<MapLoadingState />);

    act(() => {
      vi.advanceTimersByTime(MAP_SLOW_NETWORK_HINT_MS - 1);
    });
    expect(
      screen.queryByText("This may take a moment on a slow connection."),
    ).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(
      screen.getByText("This may take a moment on a slow connection."),
    ).toBeInTheDocument();
  });

  it("clears the slow-network timer on unmount", () => {
    const clearSpy = vi.spyOn(window, "clearTimeout");
    const { unmount } = render(<MapLoadingState />);
    unmount();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it("keeps a static car when reduced motion is forced", () => {
    const { container } = render(<MapLoadingState reducedMotion />);
    expect(container.querySelector(".branded-loading-car-animate")).toBeNull();
    expect(container.querySelector(".branded-loading-car")).not.toBeNull();
    expect(screen.getByTestId("branded-loading-car")).toHaveAttribute(
      "data-animated",
      "false",
    );
  });

  it("animates the car when reduced motion is off", () => {
    const { container } = render(<MapLoadingState reducedMotion={false} />);
    expect(container.querySelector(".branded-loading-car-animate")).not.toBeNull();
  });
});
