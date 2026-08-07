import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuthBrand } from "@/components/brand/AuthBrand";

describe("AuthBrand", () => {
  it("renders the Switch It wordmark with the shared app icon mark", () => {
    const { container } = render(<AuthBrand />);

    const brand = screen.getByTestId("auth-brand");
    expect(brand).toHaveTextContent("Switch It");
    expect(brand.querySelector(".switch-it-logo-mark")).not.toBeNull();
    expect(brand.querySelector(".switch-it-logo-mark__tile")).not.toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.querySelector('svg path[fill="#ffffff"]')).not.toBeNull();
  });

  it("does not load an external image for the mark", () => {
    const { container } = render(<AuthBrand />);
    expect(container.querySelector("img")).toBeNull();
  });
});
