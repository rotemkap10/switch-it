import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigationState = vi.hoisted(() => ({
  pathname: "/map",
  push: vi.fn(),
}));

const modeState = vi.hoisted(() => ({
  mode: "seeker" as "seeker" | "leaver" | null,
  setMode: vi.fn(),
  ready: true,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
  useRouter: () => ({ push: navigationState.push }),
}));

vi.mock("@/components/mode/ModeProvider", () => ({
  useMode: () => ({
    mode: modeState.mode,
    ready: modeState.ready,
    setMode: modeState.setMode,
    homeFor: (m: string) => (m === "leaver" ? "/spots/new" : "/map"),
  }),
}));

import { ModeSwitch } from "@/components/mode/ModeSwitch";

describe("ModeSwitch", () => {
  beforeEach(() => {
    navigationState.pathname = "/map";
    navigationState.push.mockReset();
    modeState.mode = "seeker";
    modeState.setMode.mockReset();
  });

  it("uses route as the source of truth for selection", () => {
    navigationState.pathname = "/spots/new";
    modeState.mode = "seeker";
    render(<ModeSwitch />);

    expect(screen.getByRole("tab", { name: "Share a spot" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Find parking" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("navigates to /map and /spots/new without Looking/Leaving labels", async () => {
    const user = userEvent.setup();
    render(<ModeSwitch />);

    expect(screen.queryByText("Looking")).not.toBeInTheDocument();
    expect(screen.queryByText("Leaving")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Share a spot" }));
    expect(modeState.setMode).toHaveBeenCalledWith("leaver");
    expect(navigationState.push).toHaveBeenCalledWith("/spots/new");
  });

  it("applies the sliding pill motion class", () => {
    const { container } = render(<ModeSwitch />);
    expect(container.querySelector(".motion-mode-pill")).not.toBeNull();
  });
});
