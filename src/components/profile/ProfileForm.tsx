"use client";

import { useActionState } from "react";

import {
  updateDisplayName,
  type ProfileActionState,
} from "@/actions/profile";

const initialState: ProfileActionState = {};

type ProfileFormProps = {
  initialDisplayName: string;
};

export function ProfileForm({ initialDisplayName }: ProfileFormProps) {
  const [state, formAction, pending] = useActionState(
    updateDisplayName,
    initialState,
  );

  const currentName = state.displayName ?? initialDisplayName;

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="display_name" className="text-sm font-medium">
          Display name
        </label>
        <input
          id="display_name"
          name="display_name"
          type="text"
          required
          minLength={2}
          maxLength={50}
          key={currentName}
          defaultValue={currentName}
          disabled={pending}
          aria-invalid={Boolean(state.fieldErrors?.display_name)}
          aria-describedby={
            state.fieldErrors?.display_name ? "display-name-error" : undefined
          }
          className="rounded border border-zinc-300 bg-white px-3 py-2 text-zinc-900 disabled:opacity-60"
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

      {state.error ? (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      ) : null}

      {state.success ? (
        <p className="text-sm text-green-700" role="status">
          Display name updated.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save display name"}
      </button>
    </form>
  );
}
