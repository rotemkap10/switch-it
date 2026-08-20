"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

import { Button } from "@/components/ui/Button";

export type CancellationReasonOption = {
  value: string;
  label: string;
};

type CancellationReasonSheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  options: readonly CancellationReasonOption[];
  selected: string | null;
  onSelectedChange: (value: string) => void;
  formAction: (formData: FormData) => void;
  hiddenFields: Record<string, string>;
  reasonFieldName?: string;
  confirmLabel: string;
  confirmPendingLabel: string;
  closeLabel: string;
  pending?: boolean;
  testId?: string;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  extraFields?: ReactNode;
};

export function CancellationReasonSheet({
  open,
  onClose,
  title,
  description,
  options,
  selected,
  onSelectedChange,
  formAction,
  hiddenFields,
  reasonFieldName = "reason",
  confirmLabel,
  confirmPendingLabel,
  closeLabel,
  pending = false,
  testId = "cancellation-reason-sheet",
  returnFocusRef,
  extraFields,
}: CancellationReasonSheetProps) {
  const titleId = useId();
  const descId = useId();
  const groupName = useId();
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const firstRadioRef = useRef<HTMLInputElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    firstRadioRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!pending) {
          onClose();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose, pending]);

  useEffect(() => {
    if (wasOpenRef.current && !open) {
      returnFocusRef?.current?.focus();
    }
    wasOpenRef.current = open;
  }, [open, returnFocusRef]);

  if (!open) {
    return null;
  }

  const canConfirm = Boolean(selected) && !pending;

  return (
    <div
      className="install-sheet-backdrop motion-fade-in"
      role="presentation"
      data-testid={`${testId}-backdrop`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) {
          onClose();
        }
      }}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className="install-sheet cancellation-sheet motion-fade-slide-up"
        data-testid={testId}
      >
        <header className="cancellation-sheet__header">
          <h2 id={titleId} className="install-sheet__title">
            {title}
          </h2>
          {description ? (
            <p id={descId} className="mt-1 text-xs leading-5 text-muted">
              {description}
            </p>
          ) : null}
        </header>

        <form action={formAction} className="cancellation-sheet__form">
          {Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          {extraFields}

          {/*
            Reasons are a normal-flow list (no fieldset). Short viewports scroll
            via .cancellation-sheet__reasons max-height — see globals.css.
          */}
          <div
            className="cancellation-sheet__reasons"
            role="radiogroup"
            aria-labelledby={titleId}
          >
            {options.map((option, index) => {
              const optionId = `${groupName}-${option.value}`;
              const isSelected = selected === option.value;
              return (
                <label
                  key={option.value}
                  htmlFor={optionId}
                  data-selected={isSelected ? "true" : "false"}
                  className="cancellation-reason-option"
                >
                  <input
                    ref={index === 0 ? firstRadioRef : undefined}
                    id={optionId}
                    type="radio"
                    name={reasonFieldName}
                    value={option.value}
                    checked={isSelected}
                    disabled={pending}
                    onChange={() => onSelectedChange(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              );
            })}
          </div>

          <div className="cancellation-sheet__actions">
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              className="w-full !min-h-[var(--app-tap-min)]"
              onClick={onClose}
            >
              {closeLabel}
            </Button>
            <Button
              type="submit"
              variant="dangerOutline"
              loading={pending}
              disabled={!canConfirm}
              className="w-full !min-h-[var(--app-tap-min)]"
            >
              {pending ? confirmPendingLabel : confirmLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
