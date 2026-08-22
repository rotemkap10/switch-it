import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("iOS LaunchScreen native assets", () => {
  it("uses the same Splash composite as Android and Capacitor", () => {
    const storyboard = readFileSync(
      resolve(
        process.cwd(),
        "ios/App/App/Base.lproj/LaunchScreen.storyboard",
      ),
      "utf8",
    );

    expect(storyboard).toContain('image="Splash"');
    expect(storyboard).toContain('contentMode="scaleAspectFill"');
    expect(storyboard).toContain('name="LaunchBackground"');
    expect(storyboard).not.toContain('image="LaunchLogo"');
    expect(storyboard).not.toContain("<resources>");
  });

  it("bundles Splash PNGs generated from the shared native splash pipeline", () => {
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
      expect(bytes.byteLength).toBeGreaterThan(100_000);
      expect(bytes.equals(reference)).toBe(true);
    }
  });
});
