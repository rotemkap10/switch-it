import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { AppFeedbackRoot } from "@/components/feedback/AppFeedbackRoot";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";
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
    >
      <head>
        {/* Critical first-paint color before CSS bundle — Dark Mode must not paint black. */}
        <style
          dangerouslySetInnerHTML={{
            __html: `html,body,:root{background:${PWA_BACKGROUND_COLOR}!important;background-color:${PWA_BACKGROUND_COLOR}!important;color-scheme: only light!important;}@media (prefers-color-scheme:dark){html,body,:root{background:${PWA_BACKGROUND_COLOR}!important;background-color:${PWA_BACKGROUND_COLOR}!important;color-scheme: only light!important;}}`,
          }}
        />
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
        <AppFeedbackRoot>{children}</AppFeedbackRoot>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
