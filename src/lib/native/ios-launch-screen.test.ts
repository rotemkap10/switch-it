import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("iOS LaunchScreen native assets", () => {
  it("centers the square LaunchMark with aspect fit at ~30% width", () => {
    const storyboard = readFileSync(
      resolve(
        process.cwd(),
        "ios/App/App/Base.lproj/LaunchScreen.storyboard",
      ),
      "utf8",
    );

    expect(storyboard).toContain('image="LaunchMark"');
    expect(storyboard).toContain('contentMode="scaleAspectFit"');
    expect(storyboard).toContain('name="LaunchBackground"');
    expect(storyboard).toContain('multiplier="0.3"');
    expect(storyboard).not.toContain('image="Splash"');
    expect(storyboard).not.toContain('image="LaunchLogo"');
    expect(storyboard).not.toContain("scaleAspectFill");
  });

  it("bundles LaunchMark PNGs generated from the shared app-icon mark", () => {
    const contents = readFileSync(
      resolve(
        process.cwd(),
        "ios/App/App/Assets.xcassets/LaunchMark.imageset/Contents.json",
      ),
      "utf8",
    );
    const parsed = JSON.parse(contents) as {
      images: Array<{ filename: string; scale: string }>;
    };

    expect(parsed.images.map((image) => image.filename)).toEqual([
      "launch-mark-1x.png",
      "launch-mark-2x.png",
      "launch-mark-3x.png",
    ]);

    const reference = readFileSync(
      resolve(
        process.cwd(),
        "ios/App/App/Assets.xcassets/LaunchMark.imageset/launch-mark-1x.png",
      ),
    );

    for (const image of parsed.images) {
      const bytes = readFileSync(
        resolve(
          process.cwd(),
          "ios/App/App/Assets.xcassets/LaunchMark.imageset",
          image.filename,
        ),
      );
      expect(bytes.byteLength).toBeGreaterThan(10_000);
      expect(bytes.equals(reference)).toBe(true);
    }
  });

  it("bundles Splash PNGs with centered app icon from the shared native pipeline", () => {
    const contents = readFileSync(
      resolve(
        process.cwd(),
        "ios/App/App/Assets.xcassets/Splash.imageset/Contents.json",
      ),
      "utf8",
    );
    const parsed = JSON.parse(contents) as {
      images: Array<{ filename: string; scale: string }>;
    };

    expect(parsed.images.map((image) => image.filename)).toEqual([
      "splash-2732x2732-2.png",
      "splash-2732x2732-1.png",
      "splash-2732x2732.png",
    ]);

    const reference = readFileSync(
      resolve(
        process.cwd(),
        "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png",
      ),
    );

    for (const image of parsed.images) {
      const bytes = readFileSync(
        resolve(
          process.cwd(),
          "ios/App/App/Assets.xcassets/Splash.imageset",
          image.filename,
        ),
      );
      expect(bytes.byteLength).toBeGreaterThan(10_000);
      expect(bytes.equals(reference)).toBe(true);
    }
  });
});
