import type { MetadataRoute } from "next";

import {
  PWA_BACKGROUND_COLOR,
  PWA_THEME_COLOR,
} from "@/lib/pwa/brand-colors";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Switch It",
    short_name: "Switch It",
    description: "Find and share public street parking handoffs nearby.",
    start_url: "/map",
    scope: "/",
    display: "standalone",
    background_color: PWA_BACKGROUND_COLOR,
    theme_color: PWA_THEME_COLOR,
    lang: "en",
    dir: "ltr",
    icons: [
      {
        src: "/pwa/icon-192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa/icon-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa/icon-512-maskable",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Find parking",
        short_name: "Find parking",
        url: "/map",
      },
      {
        name: "Share a spot",
        short_name: "Share a spot",
        url: "/spots/new",
      },
    ],
  };
}
