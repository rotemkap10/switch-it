import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageHeader } from "@/components/ui/PageHeader";

describe("PageHeader", () => {
  it("keeps the default title start-aligned", () => {
    render(<PageHeader title="Share a spot" description="Park and go." />);

    const header = screen.getByTestId("page-header");
    expect(header).toHaveAttribute("data-align", "start");
    expect(header.className).not.toContain("items-center");
    expect(screen.getByRole("heading", { name: "Share a spot" })).toBeInTheDocument();
  });

  it("centers the title and subtitle together", () => {
    render(
      <PageHeader
        title="History"
        description="Your parking handoffs."
        align="center"
      />,
    );

    const header = screen.getByTestId("page-header");
    expect(header).toHaveAttribute("data-align", "center");
    expect(header.className).toContain("items-center");
    expect(header.className).toContain("text-center");
    expect(header.className).toContain("w-full");
    expect(screen.getByRole("heading", { name: "History" })).toBeInTheDocument();
    expect(screen.getByText("Your parking handoffs.")).toBeInTheDocument();
  });
});
