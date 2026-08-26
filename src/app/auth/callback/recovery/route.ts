import { handleAuthCallback } from "@/lib/auth/auth-callback-handler";

/**
 * Password-recovery PKCE callback.
 * Supabase often redirects here with `?code=` only (no `next`), so recovery
 * must not depend on query params surviving the Auth redirect.
 */
export async function GET(request: Request) {
  return handleAuthCallback(request, { forcePasswordRecovery: true });
}
