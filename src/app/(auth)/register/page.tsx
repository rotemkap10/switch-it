import Link from "next/link";

import { RegisterForm } from "@/components/auth/RegisterForm";
import { AuthBrand } from "@/components/brand/AuthBrand";

export default function RegisterPage() {
  return (
    <main className="auth-page motion-page-enter" data-testid="register-page">
      <AuthBrand />
      <div className="auth-page-header">
        <p className="auth-step-label">Step 1 of 2</p>
        <h1 className="auth-page-title">Create your account</h1>
        <p className="auth-page-helper">
          You&apos;ll add your vehicle in the next step.
        </p>
      </div>
      <div className="mobile-form-surface">
        <RegisterForm />
      </div>
      <p className="auth-secondary-link">
        Already registered?{" "}
        <Link
          href="/login"
          className="font-medium text-accent-hover underline-offset-2 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </main>
  );
}
