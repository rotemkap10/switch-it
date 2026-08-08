import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Logo, SWITCH_IT_LOGO_SRC } from "@/components/branding/Logo";

describe("Logo", () => {
  it("renders the official asset with preserved aspect ratio classes", () => {
    render(<Logo variant="hero" />);

    const image = screen.getByRole("img", { name: "Switch It" });
    expect(image).toHaveAttribute("src", SWITCH_IT_LOGO_SRC);
    expect(image).toHaveClass("switch-it-logo");
    expect(image).toHaveClass("switch-it-logo--hero");
  });

  it("can be decorative when a parent already names the control", () => {
    const { container } = render(<Logo variant="nav" decorative />);

    const image = container.querySelector("img");
    expect(image).toHaveAttribute("alt", "");
    expect(image).toHaveClass("switch-it-logo--nav");
  });
});
