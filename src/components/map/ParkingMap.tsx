"use client";

import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";

import { ClaimSpotButton } from "@/components/map/ClaimSpotButton";
import { Countdown } from "@/components/ui/Countdown";
import { formatDateTime } from "@/lib/format/time";
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
  return (
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
        >
          <Popup>
            <div className="min-w-[12rem] space-y-2 text-sm text-slate-900">
              <p className="font-semibold">
                {spot.address?.trim()
                  ? spot.address
                  : "Public street parking spot"}
              </p>
              <p className="font-medium">
                <Countdown
                  targetIso={spot.available_at}
                  pendingLabel="Available in"
                  readyLabel="Available now"
                />
              </p>
              <p>
                <span className="text-slate-600">Leave time: </span>
                {formatDateTime(spot.available_at)}
              </p>
              {spot.canClaim ? (
                <ClaimSpotButton spotId={spot.id} />
              ) : (
                <p className="mt-1 text-slate-600">This is your published spot.</p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
