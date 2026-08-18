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
        title="Share a spot"
        description="Park and go."
        align="center"
      />,
    );

    const header = screen.getByTestId("page-header");
    expect(header).toHaveAttribute("data-align", "center");
    expect(header.className).toContain("items-center");
    expect(header.className).toContain("text-center");
    expect(header.className).toContain("w-full");
    expect(screen.getByRole("heading", { name: "Share a spot" })).toBeInTheDocument();
    expect(screen.getByText("Park and go.")).toBeInTheDocument();
  });

  it("omits the subtitle when no description is provided", () => {
    render(<PageHeader title="History" align="center" />);

    const header = screen.getByTestId("page-header");
    expect(header).toHaveAttribute("data-align", "center");
    expect(header.className).toContain("items-center");
    expect(header.className).not.toContain("gap-2");
    expect(screen.getByRole("heading", { name: "History" })).toBeInTheDocument();
    expect(screen.queryByText("Your parking handoffs.")).not.toBeInTheDocument();
    expect(header.querySelector("p")).toBeNull();
  });
});
