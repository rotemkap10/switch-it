"use client";

import { useActionState, useEffect } from "react";

import { login, type AuthActionState } from "@/actions/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const initialState: AuthActionState = {};

type LoginFormProps = {
  next: string;
};

export function LoginForm({ next }: LoginFormProps) {
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

  return (
    <form action={formAction} className="mobile-form-fields" data-testid="login-form">
      <input type="hidden" name="next" value={next} />

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
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
