"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";

import { register, type AuthActionState } from "@/actions/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const initialState: AuthActionState = {};

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
    return (
      <div
        className="auth-check-email motion-fade-in"
        data-testid="register-check-email"
        role="status"
      >
        <h2 className="auth-check-email-title">Check your email</h2>
        <p className="text-sm leading-6 text-muted">
          We sent a confirmation link. Open it to finish creating your account,
          then sign in.
        </p>
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
