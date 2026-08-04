import { describe, expect, it } from "vitest";

import {
  createMapTilerTransformRequest,
  sanitizeMapTilerUrl,
} from "@/lib/map/maptiler-transform-request";

describe("maptiler-transform-request", () => {
  it("appends the API key to MapTiler URLs that lack one", () => {
    const transform = createMapTilerTransformRequest("test-key");
    expect(transform).toBeTypeOf("function");

    const result = transform!(
      "https://api.maptiler.com/maps/streets-v4-pastel/sprite.png",
      "SpriteImage",
    );
    const url = new URL(result.url);
    expect(url.searchParams.get("key")).toBe("test-key");
    expect(url.pathname).toContain("/sprite.png");
  });

  it("does not duplicate an existing key param", () => {
    const transform = createMapTilerTransformRequest("test-key");
    const result = transform!(
      "https://api.maptiler.com/maps/streets-v4-pastel/sprite.json?key=already",
      "SpriteJSON",
    );
    const url = new URL(result.url);
    expect(url.searchParams.get("key")).toBe("already");
  });

  it("leaves non-MapTiler URLs unchanged", () => {
    const transform = createMapTilerTransformRequest("test-key");
    const result = transform!("https://example.com/tile.pbf", "Tile");
    expect(result.url).toBe("https://example.com/tile.pbf");
  });

  it("sanitizes URLs without exposing the key", () => {
    const info = sanitizeMapTilerUrl(
      "https://api.maptiler.com/maps/streets-v4-pastel/sprite.json?key=secret",
    );
    expect(info).toEqual({
      host: "api.maptiler.com",
      path: "/maps/streets-v4-pastel/sprite.json",
      hasKeyParam: true,
    });
    expect(JSON.stringify(info)).not.toContain("secret");
  });
});
