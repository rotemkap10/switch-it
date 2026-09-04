"use client";

import { RouteErrorScreen } from "@/components/shell/RouteErrorScreen";

export default function AppError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorScreen
      error={error}
      digest={error.digest}
      logScope="error-boundary"
    />
  );
}
