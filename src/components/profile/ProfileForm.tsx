"use client";

import { useActionState } from "react";

import {
  updateDisplayName,
  type ProfileActionState,
} from "@/actions/profile";
import { useActionFeedback } from "@/components/feedback/useActionFeedback";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FEEDBACK_SUCCESS_KEYS } from "@/lib/feedback/success-keys";

const initialState: ProfileActionState = {};

type ProfileFormProps = {
  initialDisplayName: string;
};

export function ProfileForm({ initialDisplayName }: ProfileFormProps) {
  const [state, formAction, pending] = useActionState(
    updateDisplayName,
    initialState,
  );

  useActionFeedback(state, {
    successMessage: FEEDBACK_SUCCESS_KEYS["profile-updated"],
    toastErrors: true,
  });

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

      <Button type="submit" loading={pending} disabled={pending} className="w-fit">
        {pending ? "Saving…" : "Save display name"}
      </Button>
    </form>
  );
}
