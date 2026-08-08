import { logoIconResponse } from "@/lib/pwa/logo-icon-response";

export const size = {
  width: 32,
  height: 32,
};

export const contentType = "image/png";

export default function Icon() {
  return logoIconResponse(32);
}
