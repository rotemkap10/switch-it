import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/Button";

describe("Button", () => {
  it("exposes a subtle dangerOutline variant for secondary destructive actions", () => {
    render(
      <Button variant="dangerOutline" data-testid="danger-outline">
        Cancel spot
      </Button>,
    );

    const button = screen.getByTestId("danger-outline");
    expect(button.className).toContain("border-accent");
    expect(button.className).toContain("text-accent");
    expect(button.className).toContain("bg-surface");
    expect(button.className).toContain("rounded-[var(--radius-card)]");
  });
});
