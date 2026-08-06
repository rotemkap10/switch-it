"use client";

import { useEffect, useId, useRef } from "react";

import { Button } from "@/components/ui/Button";

type InstallAppSheetProps = {
  open: boolean;
  onClose: () => void;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
};

export function InstallAppSheet({
  open,
  onClose,
  returnFocusRef,
}: InstallAppSheetProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      return;
    }

    returnFocusRef?.current?.focus();
  }, [open, returnFocusRef]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="install-sheet-backdrop motion-fade-in"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="install-sheet motion-fade-slide-up"
        data-testid="install-app-sheet"
      >
        <h2 id={titleId} className="install-sheet__title">
          Add Switch It to your Home Screen
        </h2>
        <ol className="install-sheet__steps">
          <li>Tap the Share button in Safari.</li>
          <li>Choose “Add to Home Screen”.</li>
          <li>Tap “Add”.</li>
        </ol>
        <p className="install-sheet__note text-xs text-muted">
          Switch It opens as a standalone app from your Home Screen.
        </p>
        <Button
          ref={closeRef}
          type="button"
          variant="secondary"
          className="install-sheet__close w-full"
          onClick={onClose}
        >
          Close
        </Button>
      </div>
    </div>
  );
}
