import { ImageResponse } from "next/og";

import { AppIconMarkup } from "@/lib/pwa/app-icon-markup";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(<AppIconMarkup size={512} maskable />, {
    width: 512,
    height: 512,
  });
}
