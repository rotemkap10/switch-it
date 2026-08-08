import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { AppFeedbackRoot } from "@/components/feedback/AppFeedbackRoot";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";
import { PWA_BACKGROUND_COLOR } from "@/lib/pwa/brand-colors";
import { IOS_STARTUP_IMAGES } from "@/lib/pwa/ios-startup";
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
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "color-scheme": "light only",
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
      style={{ backgroundColor: PWA_BACKGROUND_COLOR, colorScheme: "light" }}
    >
      <head>
        {/* Critical first-paint color before CSS bundle applies — prevents dark/empty flash. */}
        <style
          dangerouslySetInnerHTML={{
            __html: `html,body{background-color:${PWA_BACKGROUND_COLOR};color-scheme:light;}`,
          }}
        />
        {/* iOS standalone launch images — static PNGs, no JS. Portrait only. */}
        {IOS_STARTUP_IMAGES.map((image) => (
          <link
            key={image.fileName}
            rel="apple-touch-startup-image"
            href={image.href}
            media={image.media}
          />
        ))}
      </head>
      <body
        className="flex min-h-dvh flex-col bg-background text-foreground"
        style={{ backgroundColor: PWA_BACKGROUND_COLOR }}
      >
        <AppFeedbackRoot>{children}</AppFeedbackRoot>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
