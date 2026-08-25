import { NextResponse } from "next/server";

import {
  FORGOT_PASSWORD_PATH,
  isPasswordRecoveryPath,
} from "@/lib/auth/password-recovery";
import { resolvePostAuthRedirect } from "@/lib/auth/post-auth-redirect";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";
import { getAuthenticatedVehicleStatus } from "@/lib/auth/vehicle-status";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase email confirmation / password recovery / PKCE code exchange.
 * Recovery uses `?next=/auth/reset-password` and must not reuse signup-only UX.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const recovery = isPasswordRecoveryPath(next);
  const authError =
    searchParams.get("error") || searchParams.get("error_code");
  const errorDescription = searchParams.get("error_description");

  if (authError) {
    if (recovery) {
      return NextResponse.redirect(
        new URL(`${FORGOT_PASSWORD_PATH}?error=reset`, origin),
      );
    }
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

    if (recovery) {
      return NextResponse.redirect(
        new URL(`${FORGOT_PASSWORD_PATH}?error=reset`, origin),
      );
    }

    return NextResponse.redirect(
      new URL("/login?error=verification", origin),
    );
  }

  if (recovery) {
    return NextResponse.redirect(
      new URL(`${FORGOT_PASSWORD_PATH}?error=reset`, origin),
    );
  }

  return NextResponse.redirect(new URL("/login?error=verification", origin));
}
