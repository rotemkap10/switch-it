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
    expect(screen.getByText("Handoff starts in 4:37")).toBeInTheDocument();
    expect(
      screen.getByText("Then you’ll have 3 minutes to meet"),
    ).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText("Handoff starts in 4:36")).toBeInTheDocument();
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

    expect(screen.getByText("Handoff starts in 0:01")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByTestId("handoff-window-countdown")).toHaveAttribute(
      "data-phase",
      "active",
    );
    expect(screen.queryByText(/Handoff starts in 0:00/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Leaving in /)).not.toBeInTheDocument();
    expect(screen.getByText("Meetup window · 3:00 left")).toBeInTheDocument();
    expect(screen.getByText("Head to the parking spot")).toBeInTheDocument();
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

    expect(screen.getByText("Handoff starts in 3:00")).toBeInTheDocument();

    rerender(
      <HandoffWindowCountdown
        availableAtIso="2026-08-04T12:10:00.000Z"
        expiresAtIso="2026-08-04T12:10:00.000Z"
        handoffStartedAtIso="2026-08-04T12:07:00.000Z"
        claimed
        role="seeker"
      />,
    );

    expect(screen.getByText("Meetup window · 3:00 left")).toBeInTheDocument();
    expect(screen.queryByText(/^Handoff starts in /)).not.toBeInTheDocument();
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
    expect(screen.getByText("Meetup window · 3:00 left")).toBeInTheDocument();
    expect(screen.queryByText("The driver is on the way")).not.toBeInTheDocument();
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

    expect(screen.getByText("Meetup window · 1:00 left")).toBeInTheDocument();
  });

  it("keeps compact labels short and omits the helper line", () => {
    vi.setSystemTime(new Date("2026-08-04T12:05:23.000Z"));
    const { unmount } = render(
      <HandoffWindowCountdown
        availableAtIso="2026-08-04T12:10:00.000Z"
        expiresAtIso="2026-08-04T12:13:00.000Z"
        claimed
        role="seeker"
        compact
      />,
    );

    expect(screen.getByText("Handoff in 4:37")).toBeInTheDocument();
    expect(screen.queryByTestId("handoff-window-helper")).not.toBeInTheDocument();
    unmount();

    vi.setSystemTime(new Date("2026-08-04T12:10:00.000Z"));
    render(
      <HandoffWindowCountdown
        availableAtIso="2026-08-04T12:10:00.000Z"
        expiresAtIso="2026-08-04T12:13:00.000Z"
        handoffStartedAtIso="2026-08-04T12:10:00.000Z"
        claimed
        role="seeker"
        compact
      />,
    );

    expect(screen.getByText("Meetup · 3:00")).toBeInTheDocument();
    expect(screen.queryByTestId("handoff-window-helper")).not.toBeInTheDocument();
  });

  it("uses close-range remaining time once the meetup window is live", () => {
    vi.setSystemTime(new Date("2026-08-04T12:11:36.000Z"));
    render(
      <HandoffWindowCountdown
        availableAtIso="2026-08-04T12:10:00.000Z"
        expiresAtIso="2026-08-04T12:13:00.000Z"
        handoffStartedAtIso="2026-08-04T12:10:00.000Z"
        claimed
        role="seeker"
        proximity="close"
      />,
    );

    expect(screen.getByText("You’re close · 1:24 left")).toBeInTheDocument();
    expect(
      screen.getByText("Find the vehicle and complete the handoff"),
    ).toBeInTheDocument();
  });

  it("uses publisher meetup semantics during the live window", () => {
    vi.setSystemTime(new Date("2026-08-04T12:10:01.000Z"));
    render(
      <HandoffWindowCountdown
        availableAtIso="2026-08-04T12:10:00.000Z"
        expiresAtIso="2026-08-04T12:13:00.000Z"
        handoffStartedAtIso="2026-08-04T12:10:00.000Z"
        claimed
        role="publisher"
      />,
    );

    expect(screen.getByText("Meetup window · 2:59 left")).toBeInTheDocument();
    expect(screen.getByText("The driver is on the way")).toBeInTheDocument();
  });
});
