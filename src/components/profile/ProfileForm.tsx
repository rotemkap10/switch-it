"use client";

import { useActionState, useRef, useState } from "react";

import {
  updateDisplayName,
  type ProfileActionState,
} from "@/actions/profile";
import { useActionFeedback } from "@/components/feedback/useActionFeedback";
import { UserInitialAvatar } from "@/components/illustrations/UserInitialAvatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FEEDBACK_SUCCESS_KEYS } from "@/lib/feedback/success-keys";
import { useOneShotAnimation } from "@/lib/motion/use-one-shot-animation";

const initialState: ProfileActionState = {};

type ProfileFormProps = {
  initialDisplayName: string;
};

export function ProfileForm({ initialDisplayName }: ProfileFormProps) {
  const [editing, setEditing] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const avatarEntrance = useOneShotAnimation("profile-avatar-entrance");

  const [state, dispatch, pending] = useActionState(
    async (prev: ProfileActionState, formData: FormData) => {
      const result = await updateDisplayName(prev, formData);
      if (result.success) {
        setEditing(false);
        queueMicrotask(() => editButtonRef.current?.focus());
      }
      return result;
    },
    initialState,
  );

  useActionFeedback(state, {
    successMessage: FEEDBACK_SUCCESS_KEYS["profile-updated"],
    toastErrors: true,
  });

  const persistedName = state.displayName ?? initialDisplayName;

  function startEditing() {
    setFormKey((key) => key + 1);
    setEditing(true);
  }

  function cancelEditing() {
    setFormKey((key) => key + 1);
    setEditing(false);
    queueMicrotask(() => editButtonRef.current?.focus());
  }

  if (!editing) {
    return (
      <div
        className="flex items-center justify-between gap-3"
        data-testid="display-name-summary"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <UserInitialAvatar
            name={persistedName}
            animateEntrance={avatarEntrance}
            size="md"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {persistedName}
            </p>
          </div>
        </div>
        <Button
          ref={editButtonRef}
          type="button"
          variant="secondary"
          onClick={startEditing}
          className="shrink-0"
          aria-expanded={false}
          aria-controls="display-name-edit-panel"
        >
          Edit
        </Button>
      </div>
    );
  }

  return (
    <div
      id="display-name-edit-panel"
      className="motion-reveal-panel is-open"
      data-testid="display-name-edit-panel"
      role="region"
      aria-label="Edit display name"
    >
      <div className="motion-reveal-panel-inner">
        <form action={dispatch} className="flex flex-col gap-3" key={formKey}>
          <Input
            id="display_name"
            name="display_name"
            label="Display name"
            type="text"
            required
            minLength={2}
            maxLength={50}
            defaultValue={persistedName}
            disabled={pending}
            error={state.fieldErrors?.display_name?.[0]}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <Button
              type="button"
              variant="ghost"
              onClick={cancelEditing}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" loading={pending} disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
