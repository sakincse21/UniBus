/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  Map,
  MapMarker,
  MarkerContent,
  MarkerPopup,
  MarkerTooltip,
} from "@/components/ui/map";
import { useEffect, useState } from "react";
import { getSocket } from "@/lib/socket";

type BusLocation = {
  busId: number;
  lng: number;
  lat: number;
  confidence: number;
};

export default function BusMap() {
  const [locations, setLocations] = useState<Record<number, BusLocation>>({});

  useEffect(() => {
    const handler = (e: any) => {
      const data = e.detail;
      setLocations((prev) => ({
        ...prev,
        [data.busId]: {
          busId: data.busId,
          lat: data.lat,
          lng: data.lng,
          confidence: data.confidence,
        },
      }));
    };

    window.addEventListener("BUS_ESTIMATE_UPDATE", handler);
    return () => window.removeEventListener("BUS_ESTIMATE_UPDATE", handler);
  }, []);

  useEffect(() => {
    let socket: any;

    const initSocket = async () => {
      try {
        socket = await getSocket();

        socket.on("bus_location_update", (data: BusLocation) => {
          setLocations((prev) => ({
            ...prev,
            [data.busId]: data,
          }));
        });
      } catch (error) {
        console.error("Failed to initialize socket:", error);
      }
    };

    initSocket();

    return () => {
      if (socket) {
        socket.off("bus_location_update");
      }
    };
  }, []);

  return (
    <div className="w-full h-[600px] rounded border ">
      <Map center={[89.5, 22.9]} zoom={12}>
        {Object.values(locations).map((bus) => (
          <MapMarker key={bus?.busId} latitude={bus?.lat} longitude={bus?.lng}>
            <MarkerContent>
              <div
                className={`size-4 rounded-full ${
                  bus.confidence > 0.9 ? "bg-green-500" : "bg-yellow-500"
                } shadow-lg`}
              />
            </MarkerContent>
            <MarkerTooltip>{bus.busId}</MarkerTooltip>
            <MarkerPopup>
              <div className="space-y-1">
                <p className="font-medium text-foreground">{bus.busId}</p>
                <p className="text-xs text-muted-foreground">
                  {bus?.lat.toFixed(4)}, {bus?.lng.toFixed(4)}
                </p>
              </div>
            </MarkerPopup>
          </MapMarker>
        ))}
      </Map>
    </div>
  );
}
