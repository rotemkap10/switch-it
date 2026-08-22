/**
 * Extract the official square Switch It mark and write Home Screen / PWA /
 * native iOS AppIcon / Android launcher icons.
 * Does not change the in-app horizontal lockup.
 *
 * Run: npm run generate:app-icons
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import {
  extractAppMark,
  renderAppIconTile,
} from "./lib/extract-app-mark.mjs";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const logoPath = resolve(rootDir, "public/branding/switch-it-logo.png");

const { crop, fillHex } = await extractAppMark(logoPath);

async function writeIcon(outPath, size, { safeZone = 1 } = {}) {
  const buffer = await renderAppIconTile(logoPath, size, { safeZone });
  await sharp(buffer).png().toFile(outPath);
  console.log(
    `wrote ${outPath.replace(`${rootDir}/`, "")} (${size}×${size}, fill ${fillHex})`,
  );
}

mkdirSync(resolve(rootDir, "public/pwa"), { recursive: true });
mkdirSync(resolve(rootDir, "public/branding"), { recursive: true });

await writeIcon(resolve(rootDir, "public/apple-touch-icon.png"), 180);
await writeIcon(resolve(rootDir, "public/pwa/icon-192.png"), 192);
await writeIcon(resolve(rootDir, "public/pwa/icon-512.png"), 512);
await writeIcon(resolve(rootDir, "public/pwa/icon-maskable-512.png"), 512, {
  safeZone: 0.8,
});

const iosAppIconDir = resolve(
  rootDir,
  "ios/App/App/Assets.xcassets/AppIcon.appiconset",
);
mkdirSync(iosAppIconDir, { recursive: true });
await writeIcon(resolve(iosAppIconDir, "AppIcon-512@2x.png"), 1024);
writeFileSync(
  resolve(iosAppIconDir, "Contents.json"),
  `${JSON.stringify(
    {
      images: [
        {
          filename: "AppIcon-512@2x.png",
          idiom: "universal",
          platform: "ios",
          size: "1024x1024",
        },
      ],
      info: {
        author: "xcode",
        version: 1,
      },
    },
    null,
    2,
  )}\n`,
);

const androidDensities = [
  { name: "mdpi", launcher: 48, foreground: 108 },
  { name: "hdpi", launcher: 72, foreground: 162 },
  { name: "xhdpi", launcher: 96, foreground: 216 },
  { name: "xxhdpi", launcher: 144, foreground: 324 },
  { name: "xxxhdpi", launcher: 192, foreground: 432 },
];

for (const density of androidDensities) {
  const dir = resolve(rootDir, `android/app/src/main/res/mipmap-${density.name}`);
  mkdirSync(dir, { recursive: true });
  await writeIcon(resolve(dir, "ic_launcher.png"), density.launcher);
  await writeIcon(resolve(dir, "ic_launcher_round.png"), density.launcher);
  await writeIcon(resolve(dir, "ic_launcher_foreground.png"), density.foreground, {
    safeZone: 0.72,
  });
}

writeFileSync(
  resolve(rootDir, "android/app/src/main/res/values/ic_launcher_background.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${fillHex}</color>
</resources>
`,
);
console.log(
  `wrote android/app/src/main/res/values/ic_launcher_background.xml (${fillHex})`,
);

console.log("app icon mark crop", crop, `fill ${fillHex}`);
