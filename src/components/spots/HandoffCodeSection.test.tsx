import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HandoffCodeSection } from "@/components/spots/HandoffCodeSection";

describe("HandoffCodeSection", () => {
  it("renders the handoff code without helper copy", () => {
    render(<HandoffCodeSection code="48291" />);

    expect(screen.getByText("Handoff code")).toBeInTheDocument();
    expect(screen.getByTestId("handoff-code-value")).toHaveTextContent("48291");
    expect(
      screen.queryByText("Give this code to the driver when you meet."),
    ).not.toBeInTheDocument();
  });
});
