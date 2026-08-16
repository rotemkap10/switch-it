import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SeekerShareLocationCard } from "@/components/map/SeekerShareLocationCard";

describe("SeekerShareLocationCard", () => {
  it("renders nothing before sharing has started", () => {
    const { container } = render(<SeekerShareLocationCard uiState="idle" />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("Share live location")).not.toBeInTheDocument();
    expect(screen.queryByText("Not now")).not.toBeInTheDocument();
  });

  it("does not show a separate consent prompt", () => {
    const { container } = render(<SeekerShareLocationCard uiState="prompt" />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("Share your live location")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Share live location" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Not now" })).not.toBeInTheDocument();
  });

  it("shows acquiring copy without a Stop sharing action", () => {
    render(<SeekerShareLocationCard uiState="acquiring" />);
    expect(screen.getByText("Starting live location…")).toBeInTheDocument();
    expect(screen.queryByText("Live location on")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Stop sharing" }),
    ).not.toBeInTheDocument();
  });

  it("does not claim Live location on before transport succeeds", () => {
    render(<SeekerShareLocationCard uiState="acquiring" />);
    expect(screen.queryByText("Live location on")).not.toBeInTheDocument();
    expect(screen.getByText("Starting live location…")).toBeInTheDocument();
  });

  it("shows weak-signal copy without cancelling the claim", () => {
    render(<SeekerShareLocationCard uiState="weak" />);
    expect(screen.getByText("Location signal is weak")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Stop sharing" }),
    ).not.toBeInTheDocument();
  });

  it("shows live status without Stop sharing", () => {
    render(<SeekerShareLocationCard uiState="sharing" />);
    expect(screen.getByText("Live location on")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Stop sharing" }),
    ).not.toBeInTheDocument();
  });

  it("shows paused status without Stop sharing", () => {
    render(<SeekerShareLocationCard uiState="paused" />);
    expect(screen.getByText("Live location paused")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Stop sharing" }),
    ).not.toBeInTheDocument();
  });

  it("warns when permission is denied and points to release", () => {
    render(<SeekerShareLocationCard uiState="denied" />);
    expect(screen.getByText("Location permission needed")).toBeInTheDocument();
    expect(screen.getByTestId("seeker-share-location-hint")).toHaveTextContent(
      /Enable location|release the spot/i,
    );
    expect(screen.queryByText(/GeolocationPositionError/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Stop sharing" }),
    ).not.toBeInTheDocument();
  });

  it("shows delayed copy for temporary location loss", () => {
    render(<SeekerShareLocationCard uiState="unavailable" />);
    expect(screen.getByText("Live location update delayed")).toBeInTheDocument();
    expect(screen.getByTestId("seeker-share-location-hint")).toBeInTheDocument();
  });
});
