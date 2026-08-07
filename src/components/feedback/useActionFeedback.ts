"use client";

import { useEffect, useRef } from "react";

import { useFeedback } from "@/components/feedback/FeedbackProvider";
import {
  INLINE_HANDOFF_ERROR_CODES,
  type AppErrorCode,
} from "@/lib/feedback/error-map";

type ActionFeedbackState = {
  success?: boolean;
  error?: string;
  errorCode?: string;
  fieldErrors?: Record<string, string[]>;
  alreadyCompleted?: boolean;
  alreadyCancelled?: boolean;
  changed?: boolean;
};

type UseActionFeedbackOptions = {
  /** Toast shown once when success flips true. */
  successMessage?: string | ((state: ActionFeedbackState) => string | null);
  /** When true, toast RPC/form-level errors (not fieldErrors). */
  toastErrors?: boolean;
  /** Skip toast for these codes (keep inline). */
  inlineErrorCodes?: ReadonlySet<string>;
};

/**
 * Bridges useActionState results to the global feedback viewport.
 * Field validation stays inline. Handoff code errors stay inline by default.
 */
export function useActionFeedback(
  state: ActionFeedbackState,
  {
    successMessage,
    toastErrors = true,
    inlineErrorCodes = INLINE_HANDOFF_ERROR_CODES,
  }: UseActionFeedbackOptions = {},
) {
  const { success, error } = useFeedback();
  const seenSuccessRef = useRef(false);
  const seenErrorRef = useRef<string | null>(null);

  useEffect(() => {
    if (!state.success) {
      seenSuccessRef.current = false;
      return;
    }
    if (seenSuccessRef.current) {
      return;
    }
    seenSuccessRef.current = true;

    const message =
      typeof successMessage === "function"
        ? successMessage(state)
        : successMessage;

    if (message) {
      success(message);
    }
  }, [state, state.success, successMessage, success]);

  useEffect(() => {
    if (!toastErrors || !state.error) {
      seenErrorRef.current = null;
      return;
    }

    if (state.errorCode && inlineErrorCodes.has(state.errorCode)) {
      return;
    }

    const token = `${state.errorCode ?? ""}:${state.error}`;
    if (seenErrorRef.current === token) {
      return;
    }
    seenErrorRef.current = token;
    error(state.error);
  }, [toastErrors, state.error, state.errorCode, inlineErrorCodes, error]);
}

export type { AppErrorCode };
