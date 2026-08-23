import { describe, expect, it } from "vitest";

import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";

describe("getSafeRedirectPath", () => {
  it("allows internal paths such as /map and /spots/new", () => {
    expect(getSafeRedirectPath("/map")).toBe("/map");
    expect(getSafeRedirectPath("/spots/new")).toBe("/spots/new");
    expect(getSafeRedirectPath("/profile")).toBe("/profile");
    expect(getSafeRedirectPath("/help")).toBe("/help");
  });

  it("falls back to /map when next is missing", () => {
    expect(getSafeRedirectPath(undefined)).toBe("/map");
    expect(getSafeRedirectPath(null)).toBe("/map");
    expect(getSafeRedirectPath("")).toBe("/map");
  });

  it("rejects absolute URLs", () => {
    expect(getSafeRedirectPath("https://evil.com")).toBe("/map");
    expect(getSafeRedirectPath("http://evil.com/phish")).toBe("/map");
  });

  it("rejects protocol-relative URLs", () => {
    expect(getSafeRedirectPath("//evil.com")).toBe("/map");
    expect(getSafeRedirectPath("//evil.com/path")).toBe("/map");
  });

  it("rejects paths that do not start with /", () => {
    expect(getSafeRedirectPath("map")).toBe("/map");
    expect(getSafeRedirectPath("spots/new")).toBe("/map");
  });

  it("rejects backslash and control-character open redirect tricks", () => {
    expect(getSafeRedirectPath("/\\evil.com")).toBe("/map");
    expect(getSafeRedirectPath("/map\n/evil")).toBe("/map");
    expect(getSafeRedirectPath("/map%00/evil")).toBe("/map%00/evil");
  });
});
