import Link from "next/link";

import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { AuthBrand } from "@/components/brand/AuthBrand";
import { InitialShellReadyMarker } from "@/components/shell/InitialShellReadyMarker";

type ForgotPasswordPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const params = await searchParams;
  const resetLinkError = params.error === "reset";

  return (
    <main className="auth-page motion-page-enter" data-testid="forgot-password-page">
      <InitialShellReadyMarker />
      <AuthBrand />
      <div className="auth-page-header">
        <h1 className="auth-page-title">Forgot password?</h1>
        <p className="auth-page-helper">
          Enter your email and we&apos;ll send you a password reset link.
        </p>
      </div>
      <div className="mobile-form-surface">
        <ForgotPasswordForm resetLinkError={resetLinkError} />
      </div>
      <p className="auth-secondary-link">
        <Link
          href="/login"
          className="font-medium text-accent-hover underline-offset-2 hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </main>
  );
}
