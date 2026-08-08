import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";

import { AppFeedbackRoot } from "@/components/feedback/AppFeedbackRoot";
import { BootSplash } from "@/components/pwa/BootSplash";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";
import { SWITCH_IT_LAUNCH_LOGO_SRC } from "@/lib/branding/logo-asset";
import {
  APP_ROOT_ID,
  bootSplashCriticalCss,
  bootSplashSkipScript,
} from "@/lib/pwa/boot-splash";
import { PWA_BACKGROUND_COLOR } from "@/lib/pwa/brand-colors";
import {
  IOS_STARTUP_FALLBACK,
  IOS_STARTUP_IMAGES,
  iosStartupAppleWebAppImages,
} from "@/lib/pwa/ios-startup";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "Switch It",
  title: {
    default: "Switch It",
    template: "%s — Switch It",
  },
  description:
    "Find and share public street parking handoffs nearby.",
  icons: {
    icon: [
      { url: "/pwa/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/pwa/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Switch It",
    // Translucent so Dark Mode cannot paint a black status-bar chrome over the splash.
    statusBarStyle: "black-translucent",
    startupImage: iosStartupAppleWebAppImages(),
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "color-scheme": "only light",
    "supported-color-schemes": "light",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Light brand fill for both schemes so iOS Dark Mode cannot paint a black launch chrome.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: PWA_BACKGROUND_COLOR },
    { media: "(prefers-color-scheme: dark)", color: PWA_BACKGROUND_COLOR },
  ],
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      style={{ backgroundColor: PWA_BACKGROUND_COLOR, colorScheme: "only light" }}
      suppressHydrationWarning
    >
      <head>
        {/* Critical first-paint color + splash before CSS bundle / React. */}
        <style
          dangerouslySetInnerHTML={{
            __html: bootSplashCriticalCss(),
          }}
        />
        <link
          rel="preload"
          as="image"
          href={SWITCH_IT_LAUNCH_LOGO_SRC}
          fetchPriority="high"
        />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="theme-color" content={PWA_BACKGROUND_COLOR} />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: light)"
          content={PWA_BACKGROUND_COLOR}
        />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: dark)"
          content={PWA_BACKGROUND_COLOR}
        />
        {/*
          iOS launch images: specific media queries first, unqualified fallback last.
          iOS uses the first match; a no-media link first would shadow every size.
          Also declared via appleWebApp.startupImage — explicit links remain because
          iOS snapshots these at Add to Home Screen and ignores manifest splash.
        */}
        {IOS_STARTUP_IMAGES.map((image) => (
          <link
            key={image.fileName}
            rel="apple-touch-startup-image"
            href={image.href}
            media={image.media}
          />
        ))}
        <link
          rel="apple-touch-startup-image"
          href={IOS_STARTUP_FALLBACK.href}
        />
      </head>
      <body
        className="flex min-h-dvh flex-col bg-background text-foreground"
        style={{ backgroundColor: PWA_BACKGROUND_COLOR, colorScheme: "only light" }}
      >
        <Script
          id="app-boot-splash-skip"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: bootSplashSkipScript() }}
        />
        <BootSplash />
        <div
          id={APP_ROOT_ID}
          className="flex min-h-dvh flex-1 flex-col"
          style={{ backgroundColor: PWA_BACKGROUND_COLOR }}
        >
          <AppFeedbackRoot>{children}</AppFeedbackRoot>
        </div>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
