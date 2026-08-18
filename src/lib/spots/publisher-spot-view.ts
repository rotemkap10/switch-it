import type { PublisherSpotSummary } from "@/components/spots/PublisherSpotCard";

type OwnedSpotRow = {
  id: string;
  status: string;
  available_at: string;
  expires_at: string;
  handoff_started_at: string | null;
  handoff_extension_used_at: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
};

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function asTimestampString(value: unknown): string | null {
  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }
  return null;
}

export function toPublisherSpot(row: unknown): PublisherSpotSummary | null {
  if (!row || typeof row !== "object") {
    return null;
  }

  const spot = row as Partial<OwnedSpotRow>;
  const latitude = asFiniteNumber(spot.latitude);
  const longitude = asFiniteNumber(spot.longitude);
  const availableAt = asTimestampString(spot.available_at);
  const expiresAt = asTimestampString(spot.expires_at);

  if (
    typeof spot.id !== "string" ||
    !availableAt ||
    !expiresAt ||
    latitude == null ||
    longitude == null ||
    (spot.status !== "available" && spot.status !== "claimed")
  ) {
    return null;
  }

  return {
    id: spot.id,
    status: spot.status,
    available_at: availableAt,
    expires_at: expiresAt,
    handoff_started_at: asTimestampString(spot.handoff_started_at),
    handoff_extension_used_at: asTimestampString(
      spot.handoff_extension_used_at,
    ),
    address: typeof spot.address === "string" ? spot.address : null,
    latitude,
    longitude,
  };
}

export type PublisherSpotView = {
  layout: "map" | "default";
  showCompose: boolean;
  showLoadError: boolean;
  spot: PublisherSpotSummary | null;
};

/**
 * Compose map is only for a confirmed empty publisher (no open spot).
 * A failed/stale fetch must not unmount the handoff UI.
 */
export function resolvePublisherSpotView(options: {
  loadFailed: boolean;
  spot: PublisherSpotSummary | null;
}): PublisherSpotView {
  if (options.spot) {
    return {
      layout: "default",
      showCompose: false,
      showLoadError: options.loadFailed,
      spot: options.spot,
    };
  }

  if (options.loadFailed) {
    return {
      layout: "default",
      showCompose: false,
      showLoadError: true,
      spot: null,
    };
  }

  return {
    layout: "map",
    showCompose: true,
    showLoadError: false,
    spot: null,
  };
}
