import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("iOS LaunchScreen native assets", () => {
  it("centers the transparent LaunchMark with aspect fit at ~28% width", () => {
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
    expect(storyboard).toContain('multiplier="0.28"');
    expect(storyboard).not.toContain('image="Splash"');
    expect(storyboard).not.toContain('image="LaunchLogo"');
    expect(storyboard).not.toContain("scaleAspectFill");
    expect(storyboard).not.toContain('id="launch-mark-square"');
  });

  it("bundles transparent LaunchMark PNGs generated from the standalone symbol", async () => {
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
      expect(bytes.byteLength).toBeGreaterThan(5000);
      expect(bytes.equals(reference)).toBe(true);
    }

    const sharp = (await import("sharp")).default;
    const { data } = await sharp(reference)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let tileCyan = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 20) continue;
      if (b > 130 && g > 100 && r < 200 && b >= g - 5) tileCyan += 1;
    }
    expect(tileCyan).toBe(0);
  });

  it("bundles Splash PNGs with centered transparent mark from the shared native pipeline", () => {
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
      expect(bytes.byteLength).toBeGreaterThan(5000);
      expect(bytes.equals(reference)).toBe(true);
    }
  });
});
