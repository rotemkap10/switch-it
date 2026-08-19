import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";

const PROTECTED_PREFIXES = [
  "/map",
  "/profile",
  "/history",
  "/help",
  "/spots/new",
  "/onboarding",
] as const;
const AUTH_PAGES = ["/login", "/register"] as const;

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.some(
    (page) => pathname === page || pathname.startsWith(`${page}/`),
  );
}

/**
 * Refreshes Supabase auth cookies and performs optimistic route redirects.
 * Final authorization still happens in pages and Server Actions via getUser().
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, searchParams } = request.nextUrl;

  if (!user && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && isAuthPage(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = getSafeRedirectPath(searchParams.get("next"));
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
