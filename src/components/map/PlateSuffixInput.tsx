"use client";

import { useState, type ChangeEvent, type ClipboardEvent } from "react";

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
  const describedBy = error ? `${id}-error` : undefined;

  function applyDigits(next: string) {
    setValue(digitsOnly(next));
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    applyDigits(event.clipboardData.getData("text"));
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    applyDigits(event.target.value);
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <label className="text-sm font-medium text-foreground" htmlFor={id}>
        Last 2 digits
      </label>
      <input
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        pattern="[0-9]*"
        maxLength={2}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className="plate-suffix-input app-form-control"
        data-testid="plate-suffix-input"
        value={value}
        onPaste={handlePaste}
        onChange={handleChange}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
