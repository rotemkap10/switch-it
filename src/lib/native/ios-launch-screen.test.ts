import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("iOS LaunchScreen native assets", () => {
  it("references LaunchLogo from asset catalog without a storyboard-local placeholder", () => {
    const storyboard = readFileSync(
      resolve(
        process.cwd(),
        "ios/App/App/Base.lproj/LaunchScreen.storyboard",
      ),
      "utf8",
    );

    expect(storyboard).toContain('image="LaunchLogo"');
    expect(storyboard).toContain('contentMode="scaleAspectFit"');
    expect(storyboard).toContain('multiplier="0.72"');
    expect(storyboard).toContain('multiplier="0.30909090909090909"');
    expect(storyboard).not.toContain("<resources>");
    expect(storyboard).not.toContain('<image name="LaunchLogo"');
  });

  it("bundles scaled LaunchLogo PNGs in the asset catalog", () => {
    const contents = readFileSync(
      resolve(
        process.cwd(),
        "ios/App/App/Assets.xcassets/LaunchLogo.imageset/Contents.json",
      ),
      "utf8",
    );
    const parsed = JSON.parse(contents) as {
      images: Array<{ filename: string; scale: string }>;
    };

    expect(parsed.images.map((image) => image.filename)).toEqual([
      "launch-logo-1x.png",
      "launch-logo-2x.png",
      "launch-logo-3x.png",
    ]);

    for (const image of parsed.images) {
      const bytes = readFileSync(
        resolve(
          process.cwd(),
          "ios/App/App/Assets.xcassets/LaunchLogo.imageset",
          image.filename,
        ),
      );
      expect(bytes.byteLength).toBeGreaterThan(10_000);
    }
  });
});
