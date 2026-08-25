"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";

import { login, resendSignupVerification, type AuthActionState } from "@/actions/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EMAIL_VERIFICATION_RESEND_NEUTRAL_MESSAGE } from "@/lib/auth/email-verification";

const initialState: AuthActionState = {};

type LoginFormProps = {
  next: string;
  /** Shown when `/auth/callback` fails (expired / invalid link). */
  verificationLinkError?: boolean;
};

function ResendVerificationButton({
  email,
  needsEmailVerification,
}: {
  email: string;
  needsEmailVerification?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    resendSignupVerification,
    {
      email,
      needsEmailVerification,
    },
  );
  const lastSubmitAtRef = useRef(0);

  return (
    <form
      action={(formData) => {
        const now = Date.now();
        if (now - lastSubmitAtRef.current < 1_500) {
          return;
        }
        lastSubmitAtRef.current = now;
        formAction(formData);
      }}
      className="flex flex-col gap-2"
      data-testid="login-resend-verification"
    >
      <input type="hidden" name="email" value={email} />
      <Button
        type="submit"
        variant="secondary"
        loading={pending}
        disabled={pending}
        aria-busy={pending}
        className="!min-h-[var(--app-tap-min)] w-full"
      >
        {pending ? "Sending…" : "Resend verification email"}
      </Button>
      {state.resendSuccess ? (
        <p
          className="text-sm text-foreground"
          role="status"
          data-testid="resend-verification-success"
        >
          {EMAIL_VERIFICATION_RESEND_NEUTRAL_MESSAGE}
        </p>
      ) : null}
      {state.resendError ? (
        <p
          className="text-sm text-danger"
          role="alert"
          data-testid="resend-verification-error"
        >
          {state.resendError}
        </p>
      ) : null}
    </form>
  );
}

export function LoginForm({
  next,
  verificationLinkError = false,
}: LoginFormProps) {
  const [state, formAction, pending] = useActionState(login, initialState);

  useEffect(() => {
    if (state.fieldErrors?.email?.[0]) {
      document.getElementById("email")?.focus();
      return;
    }
    if (state.fieldErrors?.password?.[0]) {
      document.getElementById("password")?.focus();
    }
  }, [state.fieldErrors]);

  const needsVerification = Boolean(state.needsEmailVerification);
  const verificationEmail = state.email?.trim() ?? "";

  return (
    <div className="flex flex-col gap-4">
      <form
        action={formAction}
        className="mobile-form-fields"
        data-testid="login-form"
      >
        <input type="hidden" name="next" value={next} />

        {verificationLinkError && !needsVerification ? (
          <p
            className="rounded-[var(--radius-card)] border border-border bg-surface px-3 py-2 text-sm text-foreground"
            role="alert"
            data-testid="login-verification-link-error"
          >
            That verification link is invalid or has expired. Sign in if you
            already confirmed, or request a new email after entering your
            address below.
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
          defaultValue={verificationEmail || undefined}
          error={state.fieldErrors?.email?.[0]}
        />

        <div className="flex flex-col gap-1.5">
          <Input
            id="password"
            name="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            error={state.fieldErrors?.password?.[0]}
          />
          <p className="text-sm text-muted">
            <Link
              href="/forgot-password"
              className="font-medium text-accent-hover underline-offset-2 hover:underline"
              data-testid="forgot-password-link"
            >
              Forgot password?
            </Link>
          </p>
        </div>

        {state.error ? (
          <p
            className="text-sm text-danger"
            role="alert"
            data-testid={
              needsVerification
                ? "login-email-verification-required"
                : undefined
            }
          >
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
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {needsVerification && verificationEmail ? (
        <ResendVerificationButton
          email={verificationEmail}
          needsEmailVerification
        />
      ) : null}
    </div>
  );
}
