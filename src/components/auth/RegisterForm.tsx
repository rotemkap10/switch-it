"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";

import { register, resendSignupVerification, type AuthActionState } from "@/actions/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EMAIL_VERIFICATION_SENT_MESSAGE } from "@/lib/auth/email-verification";

const initialState: AuthActionState = {};

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
        <p
          className="text-sm text-foreground"
          role="status"
          data-testid="resend-verification-success"
        >
          {EMAIL_VERIFICATION_SENT_MESSAGE}
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

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(register, initialState);

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
          We sent a verification link
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
          . Confirm your email to finish creating your account.
        </p>
        <p className="text-sm leading-6 text-muted">
          Open the link from your inbox on this device or any other — once it
          is confirmed, you can continue in Switch It.
        </p>
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
          error={state.fieldErrors?.password?.[0]}
        />
        <p className="text-xs leading-5 text-muted">
          At least 8 characters.
        </p>
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
