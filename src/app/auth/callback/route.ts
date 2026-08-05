import { NextResponse } from "next/server";

import { resolvePostAuthRedirect } from "@/lib/auth/post-auth-redirect";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";
import { getAuthenticatedVehicleStatus } from "@/lib/auth/vehicle-status";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

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
  }

  return NextResponse.redirect(new URL("/login?error=auth", origin));
}
