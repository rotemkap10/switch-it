/**
 * Generates branded native splash assets for Capacitor iOS/Android shells.
 * Run: npm run generate:native-splash
 *
 * Single visual pipeline for both platforms:
 * - full-screen #dff4ff background
 * - centered transparent Switch It symbol (~28% of the shorter canvas side)
 *
 * Launcher / Home Screen icons are unchanged (see generate:app-icons).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadStandaloneLaunchMark,
  renderLaunchMarkSplash,
} from "./lib/extract-app-mark.mjs";

const BACKGROUND = "#dff4ff";
/** ~25–30% of the shorter side — balanced floating mark on launch. */
export const LAUNCH_MARK_RATIO = 0.28;

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const logoPath = resolve(rootDir, "public/branding/switch-it-logo.png");

/** Capacitor iOS Splash.imageset uses one logical size at 1x/2x/3x. */
const IOS_SPLASH_CANVAS = 2732;

/** Web boot splash mark — transparent symbol for preload/first paint. */
const WEB_LAUNCH_MARK_MAX = 1024;

/** iOS LaunchScreen LaunchMark.imageset reference size. */
const IOS_LAUNCH_MARK_MAX = 1024;

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

async function writePng(targetPath, width, height) {
  const buffer = await renderLaunchMarkSplash(
    logoPath,
    width,
    height,
    LAUNCH_MARK_RATIO,
    BACKGROUND,
  );
  writeFileSync(targetPath, buffer);
  console.log(`wrote ${targetPath} (${width}×${height}, ${buffer.length} bytes)`);
}

const launchMarkAsset = await loadStandaloneLaunchMark(logoPath, WEB_LAUNCH_MARK_MAX);
const launchMarkPath = resolve(rootDir, "public/branding/switch-it-launch-mark.png");
writeFileSync(launchMarkPath, launchMarkAsset.buffer);
console.log(
  `wrote public/branding/switch-it-launch-mark.png (${launchMarkAsset.width}×${launchMarkAsset.height}, transparent symbol)`,
);

const iosSplashDir = resolve(
  rootDir,
  "ios/App/App/Assets.xcassets/Splash.imageset",
);
mkdirSync(iosSplashDir, { recursive: true });

const iosSplashBuffer = await renderLaunchMarkSplash(
  logoPath,
  IOS_SPLASH_CANVAS,
  IOS_SPLASH_CANVAS,
  LAUNCH_MARK_RATIO,
  BACKGROUND,
);
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

const nativeLaunchMark = await loadStandaloneLaunchMark(logoPath, IOS_LAUNCH_MARK_MAX);
for (const fileName of [
  "launch-mark-1x.png",
  "launch-mark-2x.png",
  "launch-mark-3x.png",
]) {
  const target = resolve(iosLaunchMarkDir, fileName);
  writeFileSync(target, nativeLaunchMark.buffer);
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
