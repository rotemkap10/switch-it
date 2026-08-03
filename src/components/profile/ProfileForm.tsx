"use client";

import { useActionState } from "react";

import {
  updateDisplayName,
  type ProfileActionState,
} from "@/actions/profile";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

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
    <form action={formAction} className="flex flex-col gap-4">
      <Input
        id="display_name"
        name="display_name"
        label="Display name"
        type="text"
        required
        minLength={2}
        maxLength={50}
        key={currentName}
        defaultValue={currentName}
        disabled={pending}
        error={state.fieldErrors?.display_name?.[0]}
      />

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? (
        <Alert tone="success">Display name updated.</Alert>
      ) : null}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Saving…" : "Save display name"}
      </Button>
    </form>
  );
}
