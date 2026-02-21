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
  points: any[];
  estimate: {
    lng: number;
    lat: number;
    confidence: number;
  };
};

export default function BusMap({ points }: { points: any[] }) {
  const [locations, setLocations] = useState<Record<number, BusLocation>>({});

  useEffect(() => {
    const handler = (e: any) => {
      const data = e.detail;
      setLocations((prev) => ({
        ...prev,
        [data.busId]: {
          busId: data.busId,
          points: [],
          estimate: {
            lat: data.lat,
            lng: data.lng,
            confidence: data.confidence,
          },
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

          console.log(locations)
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
          <MapMarker key={bus?.busId} latitude={bus?.estimate.lat} longitude={bus?.estimate.lng}>
            <MarkerContent>
              <div
                className={`size-4 rounded-full ${
                  bus.estimate.confidence > 0.9 ? "bg-green-500" : "bg-yellow-500"
                } shadow-lg`}
              />
            </MarkerContent>
            <MarkerTooltip>{bus.busId}</MarkerTooltip>
            <MarkerPopup>
              <div className="space-y-1">
                <p className="font-medium text-foreground">{bus.busId}</p>
                <p className="text-xs text-muted-foreground">
                  {bus?.estimate.lat.toFixed(4)}, {bus?.estimate.lng.toFixed(4)}
                </p>
              </div>
            </MarkerPopup>
          </MapMarker>
        ))}
        {points?.map((point) => (
          <MapMarker
            key={point.sequence}
            latitude={point.lat}
            longitude={point.lng}
          >
            <MarkerContent>
              <div
                className={`size-4 rounded-full bg-blue-500 shadow-lg flex items-center justify-center text-white text-xs`}
              >
                {point.sequence}
              </div>
            </MarkerContent>
            <MarkerTooltip>{point.busId}</MarkerTooltip>
            <MarkerPopup>
              <div className="space-y-1">
                <p className="font-medium text-foreground">{point.busId}</p>
                <p className="text-xs text-muted-foreground">
                  {point?.lat.toFixed(4)}, {point?.lng.toFixed(4)}
                </p>
              </div>
            </MarkerPopup>
          </MapMarker>
        ))}
      </Map>
    </div>
  );
}
