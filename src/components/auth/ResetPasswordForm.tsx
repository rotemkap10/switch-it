"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";

import {
  updatePasswordFromRecovery,
  type AuthActionState,
} from "@/actions/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  FORGOT_PASSWORD_PATH,
  PASSWORD_RESET_LINK_INVALID_MESSAGE,
  PASSWORD_UPDATED_MESSAGE,
} from "@/lib/auth/password-recovery";
import { PASSWORD_POLICY_HINT } from "@/lib/auth/password-policy";

const initialState: AuthActionState = {};

type ResetPasswordFormProps = {
  /** False when there is no recovery session (invalid / expired link). */
  hasRecoverySession: boolean;
};

export function ResetPasswordForm({
  hasRecoverySession,
}: ResetPasswordFormProps) {
  const [state, formAction, pending] = useActionState(
    updatePasswordFromRecovery,
    initialState,
  );

  useEffect(() => {
    if (state.fieldErrors?.password?.[0]) {
      document.getElementById("password")?.focus();
      return;
    }
    if (state.fieldErrors?.confirm_password?.[0]) {
      document.getElementById("confirm_password")?.focus();
    }
  }, [state.fieldErrors]);

  if (!hasRecoverySession && !state.passwordUpdated) {
    return (
      <div
        className="auth-check-email motion-fade-in"
        data-testid="reset-password-invalid"
        role="alert"
      >
        <h2 className="auth-check-email-title">Reset link unavailable</h2>
        <p className="text-sm leading-6 text-muted">
          {PASSWORD_RESET_LINK_INVALID_MESSAGE}
        </p>
        <Link
          href={FORGOT_PASSWORD_PATH}
          className="text-sm font-medium text-accent-hover underline-offset-2 hover:underline"
          data-testid="reset-password-request-new"
        >
          Request a new reset link
        </Link>
      </div>
    );
  }

  if (state.passwordUpdated) {
    return (
      <div
        className="auth-check-email motion-fade-in"
        data-testid="reset-password-success"
        role="status"
      >
        <h2 className="auth-check-email-title">Password updated</h2>
        <p className="text-sm leading-6 text-muted">
          {PASSWORD_UPDATED_MESSAGE}
        </p>
        <Link
          href="/login"
          className="text-sm font-medium text-accent-hover underline-offset-2 hover:underline"
          data-testid="reset-password-sign-in"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const linkInvalid =
    state.error === PASSWORD_RESET_LINK_INVALID_MESSAGE;

  if (linkInvalid) {
    return (
      <div
        className="auth-check-email motion-fade-in"
        data-testid="reset-password-invalid"
        role="alert"
      >
        <h2 className="auth-check-email-title">Reset link unavailable</h2>
        <p className="text-sm leading-6 text-muted">
          {PASSWORD_RESET_LINK_INVALID_MESSAGE}
        </p>
        <Link
          href={FORGOT_PASSWORD_PATH}
          className="text-sm font-medium text-accent-hover underline-offset-2 hover:underline"
          data-testid="reset-password-request-new"
        >
          Request a new reset link
        </Link>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="mobile-form-fields"
      data-testid="reset-password-form"
    >
      <div className="flex flex-col gap-1.5">
        <Input
          id="password"
          name="password"
          label="New password"
          type="password"
          autoComplete="new-password"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          minLength={8}
          error={state.fieldErrors?.password?.[0]}
        />
        <p className="text-xs leading-5 text-muted" data-testid="password-hint">
          {PASSWORD_POLICY_HINT}
        </p>
      </div>

      <Input
        id="confirm_password"
        name="confirm_password"
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        required
        minLength={8}
        error={state.fieldErrors?.confirm_password?.[0]}
      />

      {state.error ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button
        type="submit"
        loading={pending}
        disabled={pending}
        aria-busy={pending}
        className="mobile-form-primary"
      >
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
