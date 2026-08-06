import { ImageResponse } from "next/og";

import { AppIconMarkup } from "@/lib/pwa/app-icon-markup";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(<AppIconMarkup size={192} />, {
    width: 192,
    height: 192,
  });
}
