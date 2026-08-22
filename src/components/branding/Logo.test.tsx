import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Logo, SWITCH_IT_LOGO_SRC } from "@/components/branding/Logo";
import {
  SWITCH_IT_LAUNCH_MARK_SRC,
  SWITCH_IT_LOGO_HEIGHT,
  SWITCH_IT_LOGO_WIDTH,
} from "@/lib/branding/logo-asset";

describe("Logo", () => {
  it("renders the official asset with preserved aspect ratio classes", () => {
    render(<Logo variant="hero" />);

    const image = screen.getByRole("img", { name: "Switch It" });
    expect(image).toHaveAttribute("src", SWITCH_IT_LOGO_SRC);
    expect(image).toHaveClass("switch-it-logo");
    expect(image).toHaveClass("switch-it-logo--hero");
    expect(image).toHaveAttribute("width", String(SWITCH_IT_LOGO_WIDTH));
    expect(image).toHaveAttribute("height", String(SWITCH_IT_LOGO_HEIGHT));
    expect(SWITCH_IT_LOGO_WIDTH).toBeGreaterThan(SWITCH_IT_LOGO_HEIGHT);
  });

  it("can be decorative when a parent already names the control", () => {
    const { container } = render(<Logo variant="nav" decorative />);

    const image = container.querySelector("img");
    expect(image).toHaveAttribute("alt", "");
    expect(image).toHaveClass("switch-it-logo--nav");
  });

  it("serves all variants unoptimized so branding PNGs never pass through /_next/image", () => {
    const { container: navContainer } = render(<Logo variant="nav" decorative />);
    expect(navContainer.querySelector("img")).toHaveAttribute("src", SWITCH_IT_LOGO_SRC);

    const { container: splashContainer } = render(
      <Logo variant="splash" decorative />,
    );
    const splash = splashContainer.querySelector("img");
    expect(splash).toHaveClass("switch-it-logo--splash");
    expect(splash).toHaveAttribute("src", SWITCH_IT_LAUNCH_MARK_SRC);
  });
});
