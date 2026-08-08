import Link from "next/link";

import { LoginForm } from "@/components/auth/LoginForm";
import { AuthBrand } from "@/components/brand/AuthBrand";
import { InitialShellReadyMarker } from "@/components/shell/InitialShellReadyMarker";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = getSafeRedirectPath(params.next);

  return (
    <main className="auth-page motion-page-enter" data-testid="login-page">
      <InitialShellReadyMarker />
      <AuthBrand />
      <div className="auth-page-header">
        <h1 className="auth-page-title">Welcome back</h1>
        <p className="auth-page-helper">Sign in to continue.</p>
      </div>
      <div className="mobile-form-surface">
        <LoginForm next={next} />
      </div>
      <p className="auth-secondary-link">
        New to Switch It?{" "}
        <Link
          href="/register"
          className="font-medium text-accent-hover underline-offset-2 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </main>
  );
}
