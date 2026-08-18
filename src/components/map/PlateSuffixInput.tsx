"use client";

import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";

type PlateSuffixInputProps = {
  id: string;
  name: string;
  disabled?: boolean;
  error?: string;
};

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "").slice(0, 2);
}

export function PlateSuffixInput({
  id,
  name,
  disabled = false,
  error,
}: PlateSuffixInputProps) {
  const [value, setValue] = useState("");
  const firstRef = useRef<HTMLInputElement>(null);
  const secondRef = useRef<HTMLInputElement>(null);
  const describedBy = error ? `${id}-error` : undefined;

  function applyDigits(next: string, focusSecondWhenFilled = true) {
    const digits = digitsOnly(next);
    setValue(digits);
    if (digits.length === 0) {
      firstRef.current?.focus();
      return;
    }
    if (focusSecondWhenFilled && digits.length >= 1) {
      secondRef.current?.focus();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    applyDigits(event.clipboardData.getData("text"));
  }

  function handleSecondKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && value.length <= 1) {
      event.preventDefault();
      setValue("");
      firstRef.current?.focus();
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm font-medium text-foreground" id={`${id}-label`}>
        Last 2 digits
      </p>
      <input type="hidden" name={name} value={value} />
      <div
        className="plate-suffix-input"
        role="group"
        aria-labelledby={`${id}-label`}
        aria-describedby={describedBy}
      >
        <input
          ref={firstRef}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          pattern="[0-9]*"
          maxLength={2}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          className="plate-suffix-input__digit app-form-control"
          value={value[0] ?? ""}
          autoFocus
          onPaste={handlePaste}
          onChange={(event) => {
            const next = digitsOnly(event.target.value);
            if (next.length >= 2) {
              applyDigits(next);
              return;
            }
            setValue(`${next}${value[1] ?? ""}`.slice(0, 2));
            if (next.length === 1) {
              secondRef.current?.focus();
            }
          }}
        />
        <input
          ref={secondRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          pattern="[0-9]*"
          maxLength={1}
          disabled={disabled}
          aria-label="Second plate digit"
          aria-invalid={Boolean(error)}
          className="plate-suffix-input__digit app-form-control"
          value={value[1] ?? ""}
          onPaste={handlePaste}
          onKeyDown={handleSecondKeyDown}
          onChange={(event) => {
            const digit = digitsOnly(event.target.value).slice(-1);
            setValue(`${value[0] ?? ""}${digit}`);
          }}
        />
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
