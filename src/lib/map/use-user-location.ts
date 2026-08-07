import { useCallback, useEffect, useRef, useState } from "react";

export type UserLocationState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ready";
      latitude: number;
      longitude: number;
      accuracy: number | null;
      timestamp: number;
    }
  | { status: "denied" }
  | { status: "unavailable" }
  | { status: "timeout" }
  | { status: "unsupported" };

export type GeolocationReason =
  | "denied"
  | "unavailable"
  | "timeout"
  | "unsupported";

export function geolocationErrorCodeToReason(
  code: number,
): GeolocationReason {
  // https://developer.mozilla.org/en-US/docs/Web/API/GeolocationPositionError/code
  switch (code) {
    case 1:
      return "denied";
    case 2:
      return "unavailable";
    case 3:
      return "timeout";
    default:
      return "unsupported";
  }
}

type UseUserLocationOptions = {
  enableHighAccuracy?: boolean;
  timeoutMs?: number;
  maximumAgeMs?: number;
  watch?: boolean;
};

function normalizeCoords(
  coords: GeolocationCoordinates,
): Omit<Extract<UserLocationState, { status: "ready" }>, "status"> {
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: coords.accuracy,
    timestamp: Date.now(),
  };
}

export function useUserLocation({
  enableHighAccuracy = true,
  timeoutMs = 10_000,
  maximumAgeMs = 60_000,
  watch = true,
}: UseUserLocationOptions = {}) {
  const [state, setState] = useState<UserLocationState>({ status: "idle" });
  const watchIdRef = useRef<number | null>(null);
  const autoRequestedRef = useRef(false);

  const stopWatch = useCallback(() => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
  }, []);

  const request = useCallback(() => {
    if (autoRequestedRef.current) {
      return;
    }
    autoRequestedRef.current = true;

    if (!("geolocation" in navigator) || !navigator.geolocation) {
      setState({ status: "unsupported" });
      return;
    }

    setState({ status: "loading" });

    if (!watch) {
      try {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            stopWatch();
            setState({
              status: "ready",
              ...normalizeCoords(position.coords),
              timestamp: position.timestamp ?? Date.now(),
            });
          },
          (error) => {
            stopWatch();
            const reason = geolocationErrorCodeToReason(error.code);
            setState({ status: reason });
          },
          { enableHighAccuracy, timeout: timeoutMs, maximumAge: maximumAgeMs },
        );
      } catch (err: unknown) {
        stopWatch();
        const maybe = err as { name?: unknown; code?: unknown };
        const reason =
          typeof maybe.code === "number"
            ? geolocationErrorCodeToReason(maybe.code)
            : typeof maybe.name === "string" &&
                maybe.name.toLowerCase().includes("denied")
              ? "denied"
              : "unavailable";
        setState({ status: reason });
      }
      return;
    }

    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          setState({
            status: "ready",
            ...normalizeCoords(position.coords),
            timestamp: position.timestamp ?? Date.now(),
          });
        },
        (error) => {
          // Stop watching after the first failure to avoid repeated errors.
          stopWatch();
          const reason = geolocationErrorCodeToReason(error.code);
          setState({ status: reason });
        },
        { enableHighAccuracy, timeout: timeoutMs, maximumAge: maximumAgeMs },
      );
    } catch (err: unknown) {
      stopWatch();
      const maybe = err as { name?: unknown; code?: unknown };
      const reason =
        typeof maybe.code === "number"
          ? geolocationErrorCodeToReason(maybe.code)
          : typeof maybe.name === "string" &&
              maybe.name.toLowerCase().includes("denied")
            ? "denied"
            : "unavailable";
      setState({ status: reason });
    }
  }, [enableHighAccuracy, maximumAgeMs, timeoutMs, watch, stopWatch]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      request();
    }, 0);

    return () => {
      window.clearTimeout(id);
    };
  }, [request]);

  useEffect(() => {
    return () => {
      stopWatch();
    };
  }, [stopWatch]);

  const applyFreshFix = useCallback(
    (fix: {
      latitude: number;
      longitude: number;
      accuracy: number | null;
      timestamp: number;
    }) => {
      setState({
        status: "ready",
        latitude: fix.latitude,
        longitude: fix.longitude,
        accuracy: fix.accuracy,
        timestamp: fix.timestamp,
      });
    },
    [],
  );

  return {
    state,
    requestLocation: request,
    applyFreshFix,
  };
}

