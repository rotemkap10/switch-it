"use client";

import L from "leaflet";
import { useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";

import { SelectedSpotCard } from "@/components/map/SelectedSpotCard";
import {
  MAP_DEFAULT_CENTER,
  MAP_DEFAULT_ZOOM,
  MAP_SINGLE_SPOT_ZOOM,
  type MapSpot,
} from "@/types/map-spot";

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

function MapPositionController({ spots }: { spots: MapSpot[] }) {
  const map = useMap();

  useEffect(() => {
    if (spots.length === 0) {
      map.setView(
        [MAP_DEFAULT_CENTER.lat, MAP_DEFAULT_CENTER.lng],
        MAP_DEFAULT_ZOOM,
      );
      return;
    }

    if (spots.length === 1) {
      const spot = spots[0];
      map.setView([spot.latitude, spot.longitude], MAP_SINGLE_SPOT_ZOOM);
      return;
    }

    const bounds = L.latLngBounds(
      spots.map((spot) => [spot.latitude, spot.longitude] as [number, number]),
    );
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, spots]);

  return null;
}

type ParkingMapProps = {
  spots: MapSpot[];
};

export function ParkingMap({ spots }: ParkingMapProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedSpot =
    selectedId === null
      ? null
      : (spots.find((spot) => spot.id === selectedId) ?? null);

  return (
    <div className="relative">
      <MapContainer
        center={[MAP_DEFAULT_CENTER.lat, MAP_DEFAULT_CENTER.lng]}
        zoom={MAP_DEFAULT_ZOOM}
        className="z-0 h-[60vh] min-h-[24rem] w-full"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapPositionController spots={spots} />
        {spots.map((spot) => (
          <Marker
            key={spot.id}
            position={[spot.latitude, spot.longitude]}
            icon={spotIcon}
            eventHandlers={{
              click: () => setSelectedId(spot.id),
            }}
          />
        ))}
      </MapContainer>

      {selectedSpot ? (
        <SelectedSpotCard
          spot={selectedSpot}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  );
}
