"use client";

import { useEffect } from "react";

import {
  logRouteError,
  RouteErrorScreen,
} from "@/components/shell/RouteErrorScreen";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logRouteError(error, "error-boundary");
  }, [error]);

  return <RouteErrorScreen digest={error.digest} reset={reset} />;
}
