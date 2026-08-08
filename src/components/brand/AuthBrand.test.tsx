import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuthBrand } from "@/components/brand/AuthBrand";
import { SWITCH_IT_LOGO_SRC } from "@/components/branding/Logo";

describe("AuthBrand", () => {
  it("renders the official Switch It logo", () => {
    render(<AuthBrand />);

    const brand = screen.getByTestId("auth-brand");
    const logo = brand.querySelector("img");
    expect(logo).not.toBeNull();
    expect(logo).toHaveAttribute("src", SWITCH_IT_LOGO_SRC);
    expect(logo).toHaveAttribute("alt", "Switch It");
    expect(logo).toHaveClass("switch-it-logo--auth");
    expect(brand.querySelector("svg")).toBeNull();
  });
});
