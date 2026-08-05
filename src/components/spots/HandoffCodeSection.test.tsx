import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HandoffCodeSection } from "@/components/spots/HandoffCodeSection";

describe("HandoffCodeSection", () => {
  it("renders the handoff code with helper copy", () => {
    render(<HandoffCodeSection code="48291" />);

    expect(screen.getByText("Handoff code")).toBeInTheDocument();
    expect(screen.getByTestId("handoff-code-value")).toHaveTextContent("48291");
    expect(
      screen.getByText("Give this code to the driver when they arrive."),
    ).toBeInTheDocument();
  });
});
