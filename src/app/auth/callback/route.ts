import { handleAuthCallback } from "@/lib/auth/auth-callback-handler";

/**
 * Supabase email confirmation / password recovery / PKCE code exchange.
 * Recovery may also use `/auth/callback/recovery` when `next` is not preserved.
 */
export async function GET(request: Request) {
  return handleAuthCallback(request);
}
