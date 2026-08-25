"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";

import { register, resendSignupVerification, type AuthActionState } from "@/actions/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  ACCOUNT_ALREADY_EXISTS_MESSAGE,
  EMAIL_VERIFICATION_RESEND_NEUTRAL_MESSAGE,
} from "@/lib/auth/email-verification";
import {
  PASSWORD_POLICY_SUMMARY,
  evaluatePasswordRequirements,
} from "@/lib/auth/password-policy";

const initialState: AuthActionState = {};

function SignInHint({
  testId,
  leading,
  trailing = ".",
}: {
  testId: string;
  leading: string;
  trailing?: string;
}) {
  return (
    <p
      className="text-sm leading-6 text-muted"
      data-testid={testId}
    >
      {leading}{" "}
      <Link
        href="/login"
        className="font-medium text-accent-hover underline-offset-2 hover:underline"
      >
        Sign in
      </Link>
      {trailing}
    </p>
  );
}

function ResendVerificationButton({
  email,
  checkEmail,
  needsEmailVerification,
}: {
  email: string;
  checkEmail?: boolean;
  needsEmailVerification?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    resendSignupVerification,
    {
      email,
      checkEmail,
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
      data-testid="resend-verification-form"
    >
      <input type="hidden" name="email" value={email} />
      <Button
        type="submit"
        variant="secondary"
        loading={pending}
        disabled={pending}
        aria-busy={pending}
        className="!min-h-[var(--app-tap-min)]"
      >
        {pending ? "Sending…" : "Resend email"}
      </Button>
      {state.resendSuccess ? (
        <div className="flex flex-col gap-1.5" data-testid="resend-verification-success">
          <p className="text-sm text-foreground" role="status">
            {EMAIL_VERIFICATION_RESEND_NEUTRAL_MESSAGE}
          </p>
          <SignInHint
            testId="resend-sign-in-hint"
            leading="Already have an account?"
          />
        </div>
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

function PasswordRequirementsHint({ password }: { password: string }) {
  const requirements = evaluatePasswordRequirements(password);
  const showChecklist = password.length > 0;

  return (
    <div className="flex flex-col gap-1.5" data-testid="password-requirements">
      <p className="text-xs leading-5 text-muted">{PASSWORD_POLICY_SUMMARY}</p>
      {showChecklist ? (
        <ul
          className="grid grid-cols-1 gap-0.5 text-xs leading-5 sm:grid-cols-2"
          aria-live="polite"
        >
          {requirements.map((item) => (
            <li
              key={item.id}
              data-met={item.met ? "true" : "false"}
              className={item.met ? "font-medium text-foreground" : "text-muted"}
            >
              {item.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(register, initialState);
  const [passwordValue, setPasswordValue] = useState("");

  useEffect(() => {
    const firstKey = state.fieldErrors
      ? Object.keys(state.fieldErrors)[0]
      : undefined;
    if (firstKey) {
      const id =
        firstKey === "display_name"
          ? "display_name"
          : firstKey === "email"
            ? "email"
            : firstKey === "password"
              ? "password"
              : null;
      if (id) {
        document.getElementById(id)?.focus();
      }
    }
  }, [state.fieldErrors]);

  if (state.accountExists) {
    return (
      <div
        className="auth-check-email motion-fade-in"
        data-testid="register-account-exists"
        role="status"
      >
        <h2 className="auth-check-email-title">Account already exists</h2>
        <p className="text-sm leading-6 text-muted">
          {state.error ?? ACCOUNT_ALREADY_EXISTS_MESSAGE}
        </p>
        <Link
          href="/login"
          className="text-sm font-medium text-accent-hover underline-offset-2 hover:underline"
          data-testid="register-account-exists-sign-in"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (state.checkEmail) {
    const email = state.email?.trim() ?? "";
    return (
      <div
        className="auth-check-email motion-fade-in"
        data-testid="register-check-email"
        role="status"
      >
        <h2 className="auth-check-email-title">Check your email</h2>
        <p className="text-sm leading-6 text-muted">
          Check your inbox for a verification link
          {email ? (
            <>
              {" "}
              to{" "}
              <a
                href={`mailto:${email}`}
                className="font-medium text-foreground break-all"
                data-testid="register-check-email-address"
              >
                {email}
              </a>
            </>
          ) : null}
          .
        </p>
        <p className="text-sm leading-6 text-muted">
          Confirm your email to finish creating your account.
        </p>
        <SignInHint
          testId="register-already-registered-hint"
          leading="Already registered with this email?"
          trailing=" instead."
        />
        {email ? (
          <ResendVerificationButton email={email} checkEmail />
        ) : null}
        <Link
          href="/login"
          className="text-sm font-medium text-accent-hover underline-offset-2 hover:underline"
        >
          Return to Sign in
        </Link>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="mobile-form-fields"
      data-testid="register-form"
    >
      <Input
        id="display_name"
        name="display_name"
        label="Display name"
        type="text"
        autoComplete="name"
        autoCapitalize="words"
        autoCorrect="off"
        required
        error={state.fieldErrors?.display_name?.[0]}
      />

      <Input
        id="email"
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        required
        error={state.fieldErrors?.email?.[0]}
      />

      <div className="flex flex-col gap-1.5">
        <Input
          id="password"
          name="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          minLength={8}
          value={passwordValue}
          onChange={(event) => setPasswordValue(event.target.value)}
          error={state.fieldErrors?.password?.[0]}
        />
        <PasswordRequirementsHint password={passwordValue} />
      </div>

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
        {pending ? "Creating account…" : "Continue"}
      </Button>
    </form>
  );
}
