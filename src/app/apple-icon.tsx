import { logoIconResponse } from "@/lib/pwa/logo-icon-response";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return logoIconResponse(180);
}
