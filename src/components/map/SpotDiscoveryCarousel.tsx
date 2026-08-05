"use client";

import { useEffect, useMemo, useRef } from "react";

import {
  formatDistanceAway,
  haversineDistanceMeters,
  isValidLatLng,
  type LatLng,
} from "@/lib/map/distance";
import {
  formatSpotAvailabilityLabel,
  isSpotStillListed,
  spotCarouselAddressLabel,
} from "@/lib/map/spot-availability";
import { useCoarseNow } from "@/lib/map/use-coarse-now";
import type { MapSpot } from "@/types/map-spot";

export type SpotDiscoveryCarouselProps = {
  spots: MapSpot[];
  selectedId: string | null;
  onSelect: (spotId: string) => void;
  userLocation?: LatLng | null;
  /** Lift above SelectedSpotCard when detail sheet is open. */
  raised?: boolean;
};

type CarouselCardModel = {
  id: string;
  availability: string;
  distance: string | null;
  address: string;
};

function LocationPinIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-hover"
    >
      <path
        fill="currentColor"
        d="M8 1.5a4.5 4.5 0 0 0-4.5 4.5c0 3.2 4.5 8.5 4.5 8.5s4.5-5.3 4.5-8.5A4.5 4.5 0 0 0 8 1.5Zm0 6.2a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4Z"
      />
    </svg>
  );
}

export function SpotDiscoveryCarousel({
  spots,
  selectedId,
  onSelect,
  userLocation = null,
  raised = false,
}: SpotDiscoveryCarouselProps) {
  const now = useCoarseNow(60_000);
  const listRef = useRef<HTMLDivElement | null>(null);
  const hasValidLocation = isValidLatLng(userLocation);

  const cards = useMemo((): CarouselCardModel[] => {
    return spots.filter((spot) => isSpotStillListed(spot, now)).map((spot) => {
      const distance =
        hasValidLocation
          ? formatDistanceAway(
              haversineDistanceMeters(userLocation, {
                latitude: spot.latitude,
                longitude: spot.longitude,
              }),
            )
          : null;

      return {
        id: spot.id,
        availability: formatSpotAvailabilityLabel(spot.available_at, now),
        distance: distance || null,
        address: spotCarouselAddressLabel(spot.address),
      };
    });
  }, [spots, now, hasValidLocation, userLocation]);

  useEffect(() => {
    if (!selectedId || !listRef.current) {
      return;
    }
    const card = listRef.current.querySelector<HTMLElement>(
      `[data-testid="spot-carousel-card-${selectedId}"]`,
    );
    if (!card || typeof card.scrollIntoView !== "function") {
      return;
    }
    card.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [selectedId, cards.length]);

  if (cards.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="spot-discovery-carousel"
      className={[
        "pointer-events-none absolute inset-x-0 z-[5] px-0",
        raised
          ? "bottom-[min(46vh,17.5rem)] md:bottom-[13.5rem]"
          : "bottom-10 md:bottom-8",
      ].join(" ")}
    >
      <div
        ref={listRef}
        role="listbox"
        aria-label="Available parking spots"
        className={[
          "pointer-events-auto flex snap-x snap-mandatory gap-3 overflow-x-auto",
          "px-3 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "md:max-w-3xl md:px-4",
        ].join(" ")}
      >
        {cards.map((card) => {
          const selected = card.id === selectedId;
          return (
            <button
              key={card.id}
              type="button"
              role="option"
              data-spot-id={card.id}
              data-testid={`spot-carousel-card-${card.id}`}
              aria-selected={selected}
              aria-current={selected ? "true" : undefined}
              onClick={() => onSelect(card.id)}
              className={[
                "snap-center shrink-0 rounded-[var(--radius-card)] border bg-surface text-left",
                "w-[min(82vw,20rem)] max-w-[20rem] px-3.5 py-3 md:w-[17.5rem] md:max-w-[18.75rem]",
                "transition-[border-color,box-shadow,transform] duration-[var(--motion-fast)] ease-[var(--motion-ease)]",
                selected
                  ? "border-accent-hover shadow-[var(--shadow-card-hover)] ring-2 ring-accent/40 -translate-y-0.5"
                  : "border-border shadow-[var(--shadow-card)]",
              ].join(" ")}
            >
              <p className="text-sm font-semibold text-foreground">
                {card.availability}
              </p>
              {card.distance ? (
                <p className="mt-1 text-xs text-muted">{card.distance}</p>
              ) : null}
              <p className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-foreground">
                <LocationPinIcon />
                <span className="min-w-0 truncate">{card.address}</span>
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
