"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";

import {
  requestPasswordReset,
  type AuthActionState,
} from "@/actions/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PASSWORD_RESET_CHECK_EMAIL_MESSAGE } from "@/lib/auth/password-recovery";

const initialState: AuthActionState = {};

type ForgotPasswordFormProps = {
  /** Invalid / expired recovery link recovery entry. */
  resetLinkError?: boolean;
};

export function ForgotPasswordForm({
  resetLinkError = false,
}: ForgotPasswordFormProps) {
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    initialState,
  );

  useEffect(() => {
    if (state.fieldErrors?.email?.[0]) {
      document.getElementById("email")?.focus();
    }
  }, [state.fieldErrors]);

  if (state.resetEmailSent) {
    return (
      <div
        className="auth-check-email motion-fade-in"
        data-testid="forgot-password-check-email"
        role="status"
      >
        <h2 className="auth-check-email-title">Check your email</h2>
        <p className="text-sm leading-6 text-muted">
          {PASSWORD_RESET_CHECK_EMAIL_MESSAGE}
        </p>
        <Link
          href="/login"
          className="text-sm font-medium text-accent-hover underline-offset-2 hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="mobile-form-fields"
      data-testid="forgot-password-form"
    >
      {resetLinkError ? (
        <p
          className="rounded-[var(--radius-card)] border border-border bg-surface px-3 py-2 text-sm text-foreground"
          role="alert"
          data-testid="forgot-password-link-error"
        >
          This password reset link is invalid or has expired. Enter your email
          below to request a new reset link.
        </p>
      ) : null}

      <Input
        id="email"
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        inputMode="email"
        autoFocus
        required
        defaultValue={state.email || undefined}
        error={state.fieldErrors?.email?.[0]}
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
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
