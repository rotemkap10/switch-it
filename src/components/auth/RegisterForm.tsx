"use client";

import { useActionState } from "react";

import { register, type AuthActionState } from "@/actions/auth";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const initialState: AuthActionState = {};

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(register, initialState);

  if (state.checkEmail) {
    return (
      <Alert tone="success" title="Check your email">
        We sent a confirmation link to your email. Open it to finish creating
        your account, then you will be signed in.
      </Alert>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Input
        id="display_name"
        name="display_name"
        label="Display name"
        type="text"
        autoComplete="nickname"
        required
        error={state.fieldErrors?.display_name?.[0]}
      />

      <Input
        id="email"
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        error={state.fieldErrors?.email?.[0]}
      />

      <Input
        id="password"
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        error={state.fieldErrors?.password?.[0]}
      />

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Creating account…" : "Continue"}
      </Button>
    </form>
  );
}
