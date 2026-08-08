import { logoIconResponse } from "@/lib/pwa/logo-icon-response";

export async function GET() {
  return logoIconResponse(512);
}
