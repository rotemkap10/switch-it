import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { AuthBrand } from "@/components/brand/AuthBrand";
import { InitialShellReadyMarker } from "@/components/shell/InitialShellReadyMarker";
import { createClient } from "@/lib/supabase/server";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main
      className="auth-page motion-page-enter"
      data-testid="reset-password-page"
    >
      <InitialShellReadyMarker />
      <AuthBrand />
      <div className="auth-page-header">
        <h1 className="auth-page-title">Set new password</h1>
        <p className="auth-page-helper">
          Choose a new password for your Switch It account.
        </p>
      </div>
      <div className="mobile-form-surface">
        <ResetPasswordForm hasRecoverySession={Boolean(user)} />
      </div>
    </main>
  );
}
