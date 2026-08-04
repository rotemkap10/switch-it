"use client";

import L from "leaflet";
import { useEffect, useRef } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";

import { MAP_SINGLE_SPOT_ZOOM } from "@/types/map-spot";

import "leaflet/dist/leaflet.css";

const spotIcon = new L.Icon({
  iconUrl: "/leaflet/marker-icon.png",
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  shadowUrl: "/leaflet/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

type SpotLocationPickerProps = {
  latitude: number;
  longitude: number;
  onLocationChange: (latitude: number, longitude: number) => void;
  disabled?: boolean;
  /** Kept for loader prop compatibility with the MapLibre picker. */
  userLatitude?: number | null;
  userLongitude?: number | null;
};

function MapViewSync({ latitude, longitude }: { latitude: number; longitude: number }) {
  const map = useMap();

  useEffect(() => {
    map.setView([latitude, longitude], MAP_SINGLE_SPOT_ZOOM);
  }, [latitude, longitude, map]);

  return null;
}

function PulsingMarker({
  latitude,
  longitude,
  disabled,
  onLocationChange,
}: {
  latitude: number;
  longitude: number;
  disabled: boolean;
  onLocationChange: (latitude: number, longitude: number) => void;
}) {
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) {
      return;
    }

    const iconElement = marker.getElement();
    if (!iconElement) {
      return;
    }

    iconElement.classList.add("motion-marker-pulse-once");
    const timer = window.setTimeout(() => {
      iconElement.classList.remove("motion-marker-pulse-once");
    }, 600);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <Marker
      ref={markerRef}
      position={[latitude, longitude]}
      icon={spotIcon}
      draggable={!disabled}
      eventHandlers={{
        dragend: (event) => {
          const marker = event.target;
          const position = marker.getLatLng();
          onLocationChange(position.lat, position.lng);
        },
      }}
    />
  );
}

export function SpotLocationPicker({
  latitude,
  longitude,
  onLocationChange,
  disabled = false,
}: SpotLocationPickerProps) {
  return (
    <div
      className="motion-fade-slide-up overflow-hidden rounded-[var(--radius-card)] border border-border"
      aria-label="Map to adjust your parking spot location"
    >
      <MapContainer
        center={[latitude, longitude]}
        zoom={MAP_SINGLE_SPOT_ZOOM}
        className="z-0 h-[250px] w-full"
        scrollWheelZoom={!disabled}
        dragging={!disabled}
        doubleClickZoom={!disabled}
        touchZoom={!disabled}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapViewSync latitude={latitude} longitude={longitude} />
        <PulsingMarker
          latitude={latitude}
          longitude={longitude}
          disabled={disabled}
          onLocationChange={onLocationChange}
        />
      </MapContainer>
    </div>
  );
}
