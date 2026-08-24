import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigationState = vi.hoisted(() => ({
  pathname: "/map",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
}));

import { SecondaryPageTransition } from "@/components/shell/SecondaryPageTransition";

describe("SecondaryPageTransition", () => {
  beforeEach(() => {
    navigationState.pathname = "/map";
  });

  it("uses mode-content enter on /map", () => {
    render(
      <SecondaryPageTransition>
        <p>Map</p>
      </SecondaryPageTransition>,
    );
    const shell = screen.getByTestId("mode-page-transition");
    expect(shell.className).toContain("motion-mode-content");
    expect(screen.queryByTestId("secondary-page-transition")).toBeNull();
  });

  it("uses mode-content enter on the share-a-spot route", () => {
    navigationState.pathname = "/spots/new";
    render(
      <SecondaryPageTransition>
        <p>Share</p>
      </SecondaryPageTransition>,
    );
    expect(screen.getByTestId("mode-page-transition").className).toContain(
      "motion-mode-content",
    );
  });

  it.each(["/profile", "/history", "/help", "/profile/vehicle"] as const)(
    "uses the shared page-enter wrapper on %s",
    (pathname) => {
      navigationState.pathname = pathname;
      render(
        <SecondaryPageTransition>
          <p>Secondary</p>
        </SecondaryPageTransition>,
      );
      const shell = screen.getByTestId("secondary-page-transition");
      expect(shell).toHaveAttribute("data-pathname", pathname);
      expect(shell.className).toContain("motion-page-enter");
    },
  );

  it("remounts the enter wrapper on the first client navigation to Profile", () => {
    const { rerender, container } = render(
      <SecondaryPageTransition>
        <p>From map</p>
      </SecondaryPageTransition>,
    );
    const mapNode = screen.getByTestId("mode-page-transition");

    navigationState.pathname = "/profile";
    rerender(
      <SecondaryPageTransition>
        <p>Profile</p>
      </SecondaryPageTransition>,
    );

    const profileNode = screen.getByTestId("secondary-page-transition");
    expect(profileNode).not.toBe(mapNode);
    expect(profileNode.className).toContain("motion-page-enter");
    expect(container.querySelector("[data-testid='mode-page-transition']")).toBeNull();
  });
});
