"use client";

import { Button } from "@/components/ui/Button";

export function OfflineRetryButton() {
  return (
    <Button
      type="button"
      className="offline-page__retry w-full"
      onClick={() => {
        window.location.reload();
      }}
    >
      Try again
    </Button>
  );
}
