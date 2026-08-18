import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RouteErrorScreen } from "@/components/shell/RouteErrorScreen";

describe("RouteErrorScreen", () => {
  it("renders readable title, explanation, and actions", async () => {
    const user = userEvent.setup();
    const reset = vi.fn();
    render(<RouteErrorScreen reset={reset} />);

    const title = screen.getByRole("heading", {
      name: "This page couldn’t load",
    });
    expect(title).toBeInTheDocument();
    expect(title.className).toContain("offline-page__title");
    expect(
      screen.getByText(
        "Something unexpected went wrong. Reload this page or go back.",
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reload" }));
    expect(reset).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
  });
});
