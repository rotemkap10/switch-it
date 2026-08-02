"use client";

import { useActionState, useState } from "react";

import {
  publishSpot,
  type PublishSpotActionState,
} from "@/actions/spots";
import {
  GEOLOCATION_TIMEOUT_MS,
  SPOT_MAX_WINDOW_MINUTES,
  SPOT_MIN_WINDOW_MINUTES,
} from "@/lib/spots/constants";

const initialState: PublishSpotActionState = {};

function toDateTimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function createDefaultTimes() {
  const availableAt = new Date(Date.now() + 2 * 60 * 1000);
  const expiresAt = new Date(
    availableAt.getTime() + SPOT_MIN_WINDOW_MINUTES * 60 * 1000,
  );
  return {
    availableAt: toDateTimeLocalValue(availableAt),
    expiresAt: toDateTimeLocalValue(expiresAt),
  };
}

function FieldError({
  id,
  messages,
}: {
  id: string;
  messages?: string[];
}) {
  if (!messages?.length) return null;
  return (
    <p id={id} className="text-sm text-red-600" role="alert">
      {messages[0]}
    </p>
  );
}

export function PublishSpotForm() {
  const [state, formAction, pending] = useActionState(
    publishSpot,
    initialState,
  );
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoPending, setGeoPending] = useState(false);
  const [defaults] = useState(createDefaultTimes);

  function useCurrentLocation() {
    setGeoError(null);

    if (!navigator.geolocation) {
      setGeoError(
        "Location is not supported in this browser. Enter coordinates manually.",
      );
      return;
    }

    setGeoPending(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setGeoPending(false);
      },
      () => {
        setGeoError(
          "Location unavailable. Enter coordinates manually.",
        );
        setGeoPending(false);
      },
      {
        enableHighAccuracy: true,
        timeout: GEOLOCATION_TIMEOUT_MS,
        maximumAge: 60_000,
      },
    );
  }

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">Location</p>
          <button
            type="button"
            onClick={useCurrentLocation}
            disabled={pending || geoPending}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium disabled:opacity-60"
          >
            {geoPending ? "Getting location…" : "Use my location"}
          </button>
        </div>
        {geoError ? (
          <p className="text-sm text-amber-700" role="status">
            {geoError}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="latitude" className="text-sm font-medium">
            Latitude
          </label>
          <input
            id="latitude"
            name="latitude"
            type="number"
            step="any"
            required
            min={-90}
            max={90}
            value={latitude}
            onChange={(event) => setLatitude(event.target.value)}
            disabled={pending}
            aria-invalid={Boolean(state.fieldErrors?.latitude)}
            aria-describedby={
              state.fieldErrors?.latitude ? "latitude-error" : undefined
            }
            className="rounded border border-zinc-300 bg-white px-3 py-2 text-zinc-900 disabled:opacity-60"
          />
          <FieldError id="latitude-error" messages={state.fieldErrors?.latitude} />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="longitude" className="text-sm font-medium">
            Longitude
          </label>
          <input
            id="longitude"
            name="longitude"
            type="number"
            step="any"
            required
            min={-180}
            max={180}
            value={longitude}
            onChange={(event) => setLongitude(event.target.value)}
            disabled={pending}
            aria-invalid={Boolean(state.fieldErrors?.longitude)}
            aria-describedby={
              state.fieldErrors?.longitude ? "longitude-error" : undefined
            }
            className="rounded border border-zinc-300 bg-white px-3 py-2 text-zinc-900 disabled:opacity-60"
          />
          <FieldError
            id="longitude-error"
            messages={state.fieldErrors?.longitude}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="address" className="text-sm font-medium">
          Address <span className="font-normal text-zinc-500">(optional)</span>
        </label>
        <input
          id="address"
          name="address"
          type="text"
          maxLength={200}
          disabled={pending}
          aria-invalid={Boolean(state.fieldErrors?.address)}
          aria-describedby={
            state.fieldErrors?.address ? "address-error" : undefined
          }
          className="rounded border border-zinc-300 bg-white px-3 py-2 text-zinc-900 disabled:opacity-60"
          placeholder="Street or landmark"
        />
        <FieldError id="address-error" messages={state.fieldErrors?.address} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="available_at" className="text-sm font-medium">
            Available at
          </label>
          <input
            id="available_at"
            name="available_at"
            type="datetime-local"
            required
            defaultValue={defaults.availableAt}
            disabled={pending}
            aria-invalid={Boolean(state.fieldErrors?.available_at)}
            aria-describedby={
              state.fieldErrors?.available_at ? "available-at-error" : undefined
            }
            className="rounded border border-zinc-300 bg-white px-3 py-2 text-zinc-900 disabled:opacity-60"
          />
          <FieldError
            id="available-at-error"
            messages={state.fieldErrors?.available_at}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="expires_at" className="text-sm font-medium">
            Expires at
          </label>
          <input
            id="expires_at"
            name="expires_at"
            type="datetime-local"
            required
            defaultValue={defaults.expiresAt}
            disabled={pending}
            aria-invalid={Boolean(state.fieldErrors?.expires_at)}
            aria-describedby={
              state.fieldErrors?.expires_at ? "expires-at-error" : undefined
            }
            className="rounded border border-zinc-300 bg-white px-3 py-2 text-zinc-900 disabled:opacity-60"
          />
          <FieldError
            id="expires-at-error"
            messages={state.fieldErrors?.expires_at}
          />
        </div>
      </div>

      <p className="text-xs text-zinc-500">
        Available time must be within the next 30 minutes. The spot stays open
        for {SPOT_MIN_WINDOW_MINUTES}–{SPOT_MAX_WINDOW_MINUTES} minutes after
        that.
      </p>

      {state.error ? (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Publishing…" : "Publish spot"}
      </button>
    </form>
  );
}
