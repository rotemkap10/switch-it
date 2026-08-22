/**
 * Generates branded native splash assets for Capacitor iOS/Android shells.
 * Run: npm run generate:native-splash
 *
 * Single visual pipeline for both platforms:
 * - full-screen #dff4ff background
 * - centered official Switch It logo (~72% of the shorter canvas side)
 *
 * iOS LaunchScreen.storyboard, Capacitor Splash.imageset, and Android
 * @drawable/splash all use the same composite PNG output from this script.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ImageResponse } from "next/og.js";
import { createElement } from "react";
import sharp from "sharp";

const BACKGROUND = "#dff4ff";
const LOGO_RATIO = 0.72;

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const logoPath = resolve(rootDir, "public/branding/switch-it-logo.png");
const logoPng = readFileSync(logoPath);
const logoSrc = `data:image/png;base64,${logoPng.toString("base64")}`;
const logoMeta = await sharp(logoPath).metadata();
const LOGO_ASPECT = logoMeta.width / logoMeta.height;

/** Capacitor iOS Splash.imageset uses one logical size at 1x/2x/3x. */
const IOS_SPLASH_CANVAS = 2732;

/** Web boot splash lockup width — matches logo scale in native composites. */
const WEB_LAUNCH_LOGO_WIDTH = 880;

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

function splashMarkup(width, height) {
  const logoCss = Math.round(Math.min(width, height) * LOGO_RATIO);
  const logoWidth = logoCss;
  const logoHeight = Math.round(logoWidth / LOGO_ASPECT);

  return {
    element: createElement(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: BACKGROUND,
        },
      },
      createElement("img", {
        src: logoSrc,
        width: logoWidth,
        height: logoHeight,
      }),
    ),
    width,
    height,
  };
}

async function renderSplashPng(width, height) {
  const { element, width: w, height: h } = splashMarkup(width, height);
  const response = new ImageResponse(element, { width: w, height: h });
  return Buffer.from(await response.arrayBuffer());
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

await sharp(logoPath)
  .resize({ width: WEB_LAUNCH_LOGO_WIDTH, withoutEnlargement: true })
  .png({ compressionLevel: 9 })
  .toFile(resolve(rootDir, "public/branding/switch-it-logo-launch.png"));
console.log(`wrote public/branding/switch-it-logo-launch.png (${WEB_LAUNCH_LOGO_WIDTH}px wide)`);

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
