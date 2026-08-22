/**
 * Generates branded native splash assets for Capacitor iOS/Android shells.
 * Run: npm run generate:native-splash
 *
 * Single visual pipeline for both platforms:
 * - full-screen #dff4ff background
 * - centered square Switch It app icon (~30% of the shorter canvas side)
 *
 * Source mark: public/branding/switch-it-logo.png (same as generate:app-icons).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { renderAppIconTile } from "./lib/extract-app-mark.mjs";

const BACKGROUND = "#dff4ff";
/** ~28–32% of the shorter side — balanced app-icon scale on launch. */
const ICON_RATIO = 0.3;

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const logoPath = resolve(rootDir, "public/branding/switch-it-logo.png");

/** Capacitor iOS Splash.imageset uses one logical size at 1x/2x/3x. */
const IOS_SPLASH_CANVAS = 2732;

/** Web boot splash icon — square app-icon tile for preload/first paint. */
const WEB_LAUNCH_ICON_SIZE = 512;

/** iOS LaunchScreen LaunchMark.imageset reference size. */
const IOS_LAUNCH_MARK_SIZE = 1024;

/** Android drawable buckets (portrait-first full-screen splash PNGs). */
const ANDROID_SPLASH_SIZES = [
  { dir: "drawable", width: 480, height: 800 },
  { dir: "drawable-port-mdpi", width: 320, height: 480 },
  { dir: "drawable-port-hdpi", width: 480, height: 800 },
  { dir: "drawable-port-xhdpi", width: 720, height: 1280 },
  { dir: "drawable-port-xxhdpi", width: 1080, height: 1920 },
  { dir: "drawable-port-xxxhdpi", width: 1440, height: 2560 },
  { dir: "drawable-land-mdpi", width: 480, height: 320 },
  { dir: "drawable-land-hdpi", width: 800, height: 480 },
  { dir: "drawable-land-xhdpi", width: 1280, height: 720 },
  { dir: "drawable-land-xxhdpi", width: 1920, height: 1080 },
  { dir: "drawable-land-xxxhdpi", width: 2560, height: 1440 },
];

async function renderSplashPng(width, height) {
  const iconSize = Math.round(Math.min(width, height) * ICON_RATIO);
  const iconTile = await renderAppIconTile(logoPath, iconSize);

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: BACKGROUND,
    },
  })
    .composite([{ input: iconTile, gravity: "centre" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function writePng(targetPath, width, height) {
  const buffer = await renderSplashPng(width, height);
  writeFileSync(targetPath, buffer);
  console.log(`wrote ${targetPath} (${width}×${height}, ${buffer.length} bytes)`);
}

const iosSplashDir = resolve(
  rootDir,
  "ios/App/App/Assets.xcassets/Splash.imageset",
);
mkdirSync(iosSplashDir, { recursive: true });

const iosSplashBuffer = await renderSplashPng(IOS_SPLASH_CANVAS, IOS_SPLASH_CANVAS);
for (const fileName of [
  "splash-2732x2732.png",
  "splash-2732x2732-1.png",
  "splash-2732x2732-2.png",
]) {
  const target = resolve(iosSplashDir, fileName);
  writeFileSync(target, iosSplashBuffer);
  console.log(`wrote ${target}`);
}

writeFileSync(
  resolve(iosSplashDir, "Contents.json"),
  `${JSON.stringify(
    {
      images: [
        {
          idiom: "universal",
          filename: "splash-2732x2732-2.png",
          scale: "1x",
        },
        {
          idiom: "universal",
          filename: "splash-2732x2732-1.png",
          scale: "2x",
        },
        {
          idiom: "universal",
          filename: "splash-2732x2732.png",
          scale: "3x",
        },
      ],
      info: { version: 1, author: "xcode" },
    },
    null,
    2,
  )}\n`,
);
console.log("wrote Splash.imageset/Contents.json");

const iosLaunchMarkDir = resolve(
  rootDir,
  "ios/App/App/Assets.xcassets/LaunchMark.imageset",
);
mkdirSync(iosLaunchMarkDir, { recursive: true });

const launchMarkBuffer = await renderAppIconTile(logoPath, IOS_LAUNCH_MARK_SIZE);
for (const fileName of [
  "launch-mark-1x.png",
  "launch-mark-2x.png",
  "launch-mark-3x.png",
]) {
  const target = resolve(iosLaunchMarkDir, fileName);
  writeFileSync(target, launchMarkBuffer);
  console.log(`wrote ${target}`);
}

writeFileSync(
  resolve(iosLaunchMarkDir, "Contents.json"),
  `${JSON.stringify(
    {
      images: [
        {
          idiom: "universal",
          filename: "launch-mark-1x.png",
          scale: "1x",
        },
        {
          idiom: "universal",
          filename: "launch-mark-2x.png",
          scale: "2x",
        },
        {
          idiom: "universal",
          filename: "launch-mark-3x.png",
          scale: "3x",
        },
      ],
      info: { version: 1, author: "xcode" },
    },
    null,
    2,
  )}\n`,
);
console.log("wrote LaunchMark.imageset/Contents.json");

const launchIconPath = resolve(rootDir, "public/branding/switch-it-launch-icon.png");
const launchIconBuffer = await renderAppIconTile(logoPath, WEB_LAUNCH_ICON_SIZE);
writeFileSync(launchIconPath, launchIconBuffer);
console.log(
  `wrote public/branding/switch-it-launch-icon.png (${WEB_LAUNCH_ICON_SIZE}×${WEB_LAUNCH_ICON_SIZE})`,
);

for (const { dir, width, height } of ANDROID_SPLASH_SIZES) {
  const outDir = resolve(rootDir, "android/app/src/main/res", dir);
  mkdirSync(outDir, { recursive: true });
  await writePng(resolve(outDir, "splash.png"), width, height);
}

writeFileSync(
  resolve(rootDir, "android/app/src/main/res/values/colors.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">#55bff3</color>
    <color name="colorPrimaryDark">#2fa9e6</color>
    <color name="colorAccent">#55bff3</color>
    <color name="splash_background">#dff4ff</color>
</resources>
`,
);
console.log("wrote android colors.xml");
