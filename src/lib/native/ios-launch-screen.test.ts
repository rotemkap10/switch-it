import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("iOS LaunchScreen native assets", () => {
  it("centers the rounded LaunchMark with aspect fit at ~28% width", () => {
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
    expect(storyboard).toContain('id="launch-mark-square"');
    expect(storyboard).not.toContain('image="Splash"');
    expect(storyboard).not.toContain('image="LaunchLogo"');
    expect(storyboard).not.toContain("scaleAspectFill");
  });

  it("bundles rounded LaunchMark PNGs with transparent outer corners", async () => {
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

    const sharp = (await import("sharp")).default;
    const { data, info } = await sharp(reference)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    expect(info.width).toBe(1024);
    expect(info.height).toBe(1024);

    const cornerSize = 55;
    let cornerTransparent = 0;
    let cornerCyan = 0;
    for (let y = 0; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        const inCorner =
          (x < cornerSize && y < cornerSize) ||
          (x >= info.width - cornerSize && y < cornerSize) ||
          (x < cornerSize && y >= info.height - cornerSize) ||
          (x >= info.width - cornerSize && y >= info.height - cornerSize);
        if (!inCorner) continue;

        const i = (y * info.width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a < 20) {
          cornerTransparent += 1;
          continue;
        }
        if (b > 130 && g > 100 && r < 200 && b >= g - 5) {
          cornerCyan += 1;
        }
      }
    }

    expect(cornerTransparent).toBeGreaterThan(cornerSize * cornerSize * 2.5);
    expect(cornerCyan).toBe(0);
  });

  it("bundles Splash PNGs with centered rounded icon from the shared native pipeline", () => {
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
