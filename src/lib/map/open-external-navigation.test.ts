import { afterEach, describe, expect, it, vi } from "vitest";

import { openExternalNavigationUrl } from "@/lib/map/navigation-urls";

describe("openExternalNavigationUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses window.open in a normal browser tab", () => {
    const openSpy = vi.fn(() => ({ closed: false }));
    vi.stubGlobal("open", openSpy);
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );

    openExternalNavigationUrl(
      "https://waze.com/ul?ll=32.085312%2C34.781812&navigate=yes&utm_source=switch_it",
    );

    expect(openSpy).toHaveBeenCalledWith(
      "https://waze.com/ul?ll=32.085312%2C34.781812&navigate=yes&utm_source=switch_it",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("uses a blank-target anchor in standalone PWA display", () => {
    const openSpy = vi.fn();
    const click = vi.fn();
    vi.stubGlobal("open", openSpy);
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("display-mode: standalone"),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = createElement(tag);
      if (tag === "a") {
        Object.defineProperty(el, "click", { value: click });
      }
      return el;
    });

    openExternalNavigationUrl(
      "https://maps.apple.com/?daddr=32.085312%2C34.781812&dirflg=d",
    );

    expect(openSpy).not.toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
  });
});
