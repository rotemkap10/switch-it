import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CarImagesDocumentHints } from "@/components/vehicle/CarImagesDocumentHints";
import { carImagesLoaderScriptUrl } from "@/lib/vehicle/carimages";

describe("CarImagesDocumentHints", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("omits hints when the public loader key is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_CARIMAGES_API_KEY", "");
    const { container } = render(<CarImagesDocumentHints />);
    expect(container).toBeEmptyDOMElement();
  });

  it("preconnects the catalog hosts and preloads the loader script", () => {
    vi.stubEnv("NEXT_PUBLIC_CARIMAGES_API_KEY", "ci_public_test");
    const { container } = render(<CarImagesDocumentHints />, {
      container: document.head as unknown as HTMLElement,
    });

    expect(
      container.querySelector('link[rel="preconnect"][href="https://carimagesapi.com"]'),
    ).not.toBeNull();
    expect(
      container.querySelector(
        'link[rel="preconnect"][href="https://cdn.carimagesapi.com"]',
      ),
    ).not.toBeNull();
    expect(
      container.querySelector(
        `link[rel="preload"][as="script"][href="${carImagesLoaderScriptUrl()}"]`,
      ),
    ).not.toBeNull();
  });
});
