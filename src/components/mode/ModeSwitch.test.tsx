import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigationState = vi.hoisted(() => ({
  pathname: "/map",
  push: vi.fn(),
  prefetch: vi.fn(),
}));

const modeState = vi.hoisted(() => ({
  mode: "seeker" as "seeker" | "leaver" | null,
  setMode: vi.fn(),
  ready: true,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
  useRouter: () => ({
    push: navigationState.push,
    prefetch: navigationState.prefetch,
  }),
}));

vi.mock("@/components/mode/ModeProvider", () => ({
  useMode: () => ({
    mode: modeState.mode,
    ready: modeState.ready,
    setMode: modeState.setMode,
    homeFor: (m: string) => (m === "leaver" ? "/spots/new" : "/map"),
  }),
}));

const beginRouteTransition = vi.hoisted(() => vi.fn());

vi.mock("@/components/shell/RouteTransitionProvider", () => ({
  useRouteTransition: () => ({
    beginRouteTransition,
    cancelRouteTransition: vi.fn(),
    isTransitioning: false,
  }),
}));

import { ModeSwitch } from "@/components/mode/ModeSwitch";
import { MODE_HOME, MODE_LABELS } from "@/lib/mode/constants";

describe("ModeSwitch", () => {
  beforeEach(() => {
    navigationState.pathname = "/map";
    navigationState.push.mockReset();
    navigationState.prefetch.mockReset();
    modeState.mode = "seeker";
    modeState.setMode.mockReset();
    beginRouteTransition.mockReset();
  });

  it("uses route as the source of truth for selection", () => {
    navigationState.pathname = MODE_HOME.leaver;
    modeState.mode = "seeker";
    render(<ModeSwitch />);

    expect(screen.getByRole("tab", { name: MODE_LABELS.leaver })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: MODE_LABELS.seeker })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("navigates with client router.push and immediate pending feedback", async () => {
    const user = userEvent.setup();
    render(<ModeSwitch />);

    expect(screen.queryByText("Looking")).not.toBeInTheDocument();
    expect(screen.queryByText("Leaving")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: MODE_LABELS.leaver }));
    expect(modeState.setMode).toHaveBeenCalledWith("leaver");
    expect(beginRouteTransition).toHaveBeenCalledWith(MODE_HOME.leaver);
    expect(navigationState.push).toHaveBeenCalledWith(MODE_HOME.leaver);
    expect(screen.getByTestId("mode-switch")).toHaveAttribute(
      "data-pending",
      "true",
    );
    expect(screen.getByRole("tab", { name: MODE_LABELS.leaver })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("does not navigate again while a transition is pending", async () => {
    const user = userEvent.setup();
    render(<ModeSwitch />);

    await user.click(screen.getByRole("tab", { name: MODE_LABELS.leaver }));
    await user.click(screen.getByRole("tab", { name: MODE_LABELS.leaver }));

    expect(navigationState.push).toHaveBeenCalledTimes(1);
  });

  it("applies the sliding pill motion class on primary map routes", () => {
    const { container } = render(<ModeSwitch />);
    expect(container.querySelector(".motion-mode-pill")).not.toBeNull();
  });

  it("keeps Find parking active and Share a spot inactive on /map", () => {
    render(<ModeSwitch />);
    expect(screen.getByTestId("mode-switch")).toHaveAttribute(
      "data-active-mode",
      "seeker",
    );
    expect(screen.getByRole("tab", { name: MODE_LABELS.seeker })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: MODE_LABELS.leaver })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("keeps Share a spot active and Find parking inactive on the share route", () => {
    navigationState.pathname = MODE_HOME.leaver;
    render(<ModeSwitch />);
    expect(screen.getByTestId("mode-switch")).toHaveAttribute(
      "data-active-mode",
      "leaver",
    );
    expect(screen.getByRole("tab", { name: MODE_LABELS.leaver })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: MODE_LABELS.seeker })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it.each(["/profile", "/history", "/help", "/profile/vehicle"] as const)(
    "activates neither map tab on %s",
    (pathname) => {
      navigationState.pathname = pathname;
      modeState.mode = "seeker";
      render(<ModeSwitch />);

      expect(screen.getByTestId("mode-switch")).toHaveAttribute(
        "data-active-mode",
        "none",
      );
      expect(screen.queryByTestId("mode-switch-pill")).not.toBeInTheDocument();
      expect(
        screen.getByRole("tab", { name: MODE_LABELS.seeker }),
      ).toHaveAttribute("aria-selected", "false");
      expect(
        screen.getByRole("tab", { name: MODE_LABELS.leaver }),
      ).toHaveAttribute("aria-selected", "false");
      expect(
        screen.getByRole("tab", { name: MODE_LABELS.seeker }),
      ).not.toHaveAttribute("aria-current");
      expect(
        screen.getByRole("tab", { name: MODE_LABELS.leaver }),
      ).not.toHaveAttribute("aria-current");
    },
  );
});
