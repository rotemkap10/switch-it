import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HandoffWindowCountdown } from "@/components/ui/HandoffWindowCountdown";

describe("HandoffWindowCountdown live clock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts down to available_at with a live M:SS clock", () => {
    vi.setSystemTime(new Date("2026-08-04T12:05:23.000Z"));
    render(
      <HandoffWindowCountdown
        availableAtIso="2026-08-04T12:10:00.000Z"
        expiresAtIso="2026-08-04T12:13:00.000Z"
        claimed
        role="seeker"
      />,
    );

    expect(screen.getByTestId("handoff-window-countdown")).toHaveAttribute(
      "data-phase",
      "scheduled",
    );
    expect(screen.getByText("Leaving in 4:37")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText("Leaving in 4:36")).toBeInTheDocument();
  });

  it("transitions from the departure clock to the 3-minute live window at zero", () => {
    vi.setSystemTime(new Date("2026-08-04T12:09:59.000Z"));
    const onDepartureDue = vi.fn();
    render(
      <HandoffWindowCountdown
        availableAtIso="2026-08-04T12:10:00.000Z"
        expiresAtIso="2026-08-04T12:13:00.000Z"
        claimed
        role="seeker"
        onDepartureDue={onDepartureDue}
      />,
    );

    expect(screen.getByText("Leaving in 0:01")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByTestId("handoff-window-countdown")).toHaveAttribute(
      "data-phase",
      "active",
    );
    expect(screen.queryByText(/Leaving in 0:00/)).not.toBeInTheDocument();
    expect(
      screen.getByText("Complete the handoff · 3:00 left"),
    ).toBeInTheDocument();
    expect(onDepartureDue).toHaveBeenCalledTimes(1);
  });

  it("switches to the live window immediately after an early I'm leaving now", () => {
    vi.setSystemTime(new Date("2026-08-04T12:07:00.000Z"));
    const { rerender } = render(
      <HandoffWindowCountdown
        availableAtIso="2026-08-04T12:10:00.000Z"
        expiresAtIso="2026-08-04T12:13:00.000Z"
        claimed
        role="seeker"
      />,
    );

    expect(screen.getByText("Leaving in 3:00")).toBeInTheDocument();

    rerender(
      <HandoffWindowCountdown
        availableAtIso="2026-08-04T12:10:00.000Z"
        expiresAtIso="2026-08-04T12:10:00.000Z"
        handoffStartedAtIso="2026-08-04T12:07:00.000Z"
        claimed
        role="seeker"
      />,
    );

    expect(
      screen.getByText("Complete the handoff · 3:00 left"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Leaving in /)).not.toBeInTheDocument();
  });

  it("shows remaining live time for an unclaimed Now-style listing", () => {
    vi.setSystemTime(new Date("2026-08-04T12:07:00.000Z"));
    render(
      <HandoffWindowCountdown
        availableAtIso="2026-08-04T12:10:00.000Z"
        expiresAtIso="2026-08-04T12:10:00.000Z"
        handoffStartedAtIso="2026-08-04T12:07:00.000Z"
        claimed={false}
        role="publisher"
      />,
    );

    expect(screen.getByTestId("handoff-window-countdown")).toHaveAttribute(
      "data-phase",
      "active",
    );
    expect(
      screen.getByText("Waiting for driver · 3:00 left"),
    ).toBeInTheDocument();
  });

  it("does not reset the live window when a seeker claims mid-handoff", () => {
    vi.setSystemTime(new Date("2026-08-04T12:09:00.000Z"));
    render(
      <HandoffWindowCountdown
        availableAtIso="2026-08-04T12:10:00.000Z"
        expiresAtIso="2026-08-04T12:10:00.000Z"
        handoffStartedAtIso="2026-08-04T12:07:00.000Z"
        claimed
        role="seeker"
      />,
    );

    expect(
      screen.getByText("Complete the handoff · 1:00 left"),
    ).toBeInTheDocument();
  });
});
