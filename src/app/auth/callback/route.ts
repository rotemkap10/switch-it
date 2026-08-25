import { NextResponse } from "next/server";

import { resolvePostAuthRedirect } from "@/lib/auth/post-auth-redirect";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";
import { getAuthenticatedVehicleStatus } from "@/lib/auth/vehicle-status";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase email confirmation / PKCE code exchange.
 * On success, reuses the same onboarding-aware redirect as login.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const authError =
    searchParams.get("error") || searchParams.get("error_code");
  const errorDescription = searchParams.get("error_description");

  if (authError) {
    const params = new URLSearchParams({ error: "verification" });
    if (errorDescription) {
      params.set("reason", errorDescription.slice(0, 120));
    }
    return NextResponse.redirect(
      new URL(`/login?${params.toString()}`, origin),
    );
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const status = await getAuthenticatedVehicleStatus(supabase, user.id);
        const path = resolvePostAuthRedirect(status, next);
        return NextResponse.redirect(new URL(path, origin));
      }

      return NextResponse.redirect(
        new URL(getSafeRedirectPath(next), origin),
      );
    }

    return NextResponse.redirect(
      new URL("/login?error=verification", origin),
    );
  }

  return NextResponse.redirect(new URL("/login?error=verification", origin));
}
