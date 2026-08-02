"use client";

import { useActionState } from "react";

import { register, type AuthActionState } from "@/actions/auth";

const initialState: AuthActionState = {};

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(register, initialState);

  if (state.checkEmail) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-3" role="status">
        <h2 className="text-lg font-semibold">Check your email</h2>
        <p className="text-sm text-zinc-600">
          We sent a confirmation link to your email. Open it to finish creating
          your account, then you will be signed in.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="display_name" className="text-sm font-medium">
          Display name
        </label>
        <input
          id="display_name"
          name="display_name"
          type="text"
          autoComplete="nickname"
          required
          aria-invalid={Boolean(state.fieldErrors?.display_name)}
          aria-describedby={
            state.fieldErrors?.display_name ? "display-name-error" : undefined
          }
          className="rounded border border-zinc-300 bg-white px-3 py-2 text-zinc-900"
        />
        {state.fieldErrors?.display_name ? (
          <p
            id="display-name-error"
            className="text-sm text-red-600"
            role="alert"
          >
            {state.fieldErrors.display_name[0]}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={Boolean(state.fieldErrors?.email)}
          aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
          className="rounded border border-zinc-300 bg-white px-3 py-2 text-zinc-900"
        />
        {state.fieldErrors?.email ? (
          <p id="email-error" className="text-sm text-red-600" role="alert">
            {state.fieldErrors.email[0]}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          aria-invalid={Boolean(state.fieldErrors?.password)}
          aria-describedby={
            state.fieldErrors?.password ? "password-error" : undefined
          }
          className="rounded border border-zinc-300 bg-white px-3 py-2 text-zinc-900"
        />
        {state.fieldErrors?.password ? (
          <p id="password-error" className="text-sm text-red-600" role="alert">
            {state.fieldErrors.password[0]}
          </p>
        ) : null}
      </div>

      {state.error ? (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
