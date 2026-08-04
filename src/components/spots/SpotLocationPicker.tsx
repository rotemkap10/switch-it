"use client";

import L from "leaflet";
import { useEffect } from "react";
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
};

function MapViewSync({ latitude, longitude }: { latitude: number; longitude: number }) {
  const map = useMap();

  useEffect(() => {
    map.setView([latitude, longitude], MAP_SINGLE_SPOT_ZOOM);
  }, [latitude, longitude, map]);

  return null;
}

export function SpotLocationPicker({
  latitude,
  longitude,
  onLocationChange,
  disabled = false,
}: SpotLocationPickerProps) {
  return (
    <div
      className="motion-fade-in overflow-hidden rounded-[var(--radius-card)] border border-border"
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
        <Marker
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
      </MapContainer>
    </div>
  );
}
