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
  isLive: boolean;
  estimate: {
    lng: number;
    lat: number;
    confidence: number;
  };
};

function to12h(time24: string): string {
  const [hh, mm] = time24.split(":").map(Number);
  const suffix = hh >= 12 ? "PM" : "AM";
  const h = hh % 12 || 12;
  return `${h}:${mm.toString().padStart(2, "0")} ${suffix}`;
}

function pointTime(startTime: string | null, minuteOffset: number): string {
  if (!startTime) return `+${minuteOffset}m`;
  const [sh, sm] = startTime.split(":").map(Number);
  const totalMin = sh * 60 + sm + minuteOffset;
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  return to12h(`${h}:${m}`);
}

export default function BusMap({ points, startTime }: { points: any[]; startTime?: string | null }) {
  const [locations, setLocations] = useState<Record<number, BusLocation>>({});

  // Listen for estimated location from tracking request
  useEffect(() => {
    const handler = (e: any) => {
      const data = e.detail;
      setLocations((prev) => ({
        ...prev,
        [data.busId]: {
          busId: data.busId,
          points: [],
          isLive: false,
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

  // Listen for live location updates via socket
  useEffect(() => {
    let socket: any;

    const initSocket = async () => {
      try {
        socket = await getSocket();

        socket.on("bus_location_update", (data: any) => {
          setLocations((prev) => ({
            ...prev,
            [data.busId]: {
              busId: data.busId,
              points: data.points || [],
              isLive: true,
              estimate: {
                lat: data.estimate?.lat ?? data.lat,
                lng: data.estimate?.lng ?? data.lng,
                confidence: data.estimate?.confidence ?? 1,
              },
            },
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

  // Listen for tracking ended — remove bus from map
  useEffect(() => {
    const handler = (e: any) => {
      const data = e.detail;
      if (data?.busId) {
        setLocations((prev) => {
          const next = { ...prev };
          delete next[data.busId];
          return next;
        });
      }
    };

    window.addEventListener("BUS_TRACKING_ENDED", handler);
    return () => window.removeEventListener("BUS_TRACKING_ENDED", handler);
  }, []);

  return (
    <div className="w-full h-[600px] rounded border ">
      <Map center={[89.5, 22.9]} zoom={12}>
        {Object.values(locations).map((bus) => (
          <MapMarker key={bus?.busId} latitude={bus?.estimate.lat} longitude={bus?.estimate.lng}>
            <MarkerContent>
              <div
                className={`size-4 rounded-full ${
                  bus.isLive
                    ? "bg-green-500"
                    : bus.estimate.confidence > 0.7
                      ? "bg-yellow-500"
                      : "bg-orange-500"
                } shadow-lg`}
              />
            </MarkerContent>
            <MarkerTooltip>
              Bus {bus.busId} {bus.isLive ? "(Live)" : "(Estimated)"}
            </MarkerTooltip>
            <MarkerPopup>
              <div className="space-y-1">
                <p className="font-medium text-foreground">
                  Bus {bus.busId} — {bus.isLive ? "Live" : "Estimated"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {bus?.estimate.lat.toFixed(4)}, {bus?.estimate.lng.toFixed(4)}
                </p>
                {!bus.isLive && (
                  <p className="text-xs text-muted-foreground">
                    Confidence: {(bus.estimate.confidence * 100).toFixed(0)}%
                  </p>
                )}
              </div>
            </MarkerPopup>
          </MapMarker>
        ))}
        {points?.map((point, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === points.length - 1;
          const time = pointTime(startTime ?? null, point.minuteOffset);

          // Color: green for start, red for end, blue for intermediate
          const bgColor = isFirst
            ? "bg-green-600"
            : isLast
              ? "bg-red-600"
              : "bg-blue-500";

          const label = isFirst ? "Start" : isLast ? "End" : `#${point.sequence}`;

          return (
            <MapMarker
              key={point.sequence}
              latitude={point.lat}
              longitude={point.lng}
            >
              <MarkerContent>
                <div className="flex flex-col items-center gap-0.5">
                  <span className={`text-[10px] font-semibold text-foreground bg-background/80 px-1 rounded shadow`}>
                    {time}
                  </span>
                  <div
                    className={`${isFirst || isLast ? "size-5" : "size-4"} rounded-full ${bgColor} shadow-lg flex items-center justify-center text-white text-[9px] font-bold border-2 ${isFirst ? "border-green-300" : isLast ? "border-red-300" : "border-transparent"}`}
                  >
                    {isFirst ? "S" : isLast ? "E" : point.sequence}
                  </div>
                </div>
              </MarkerContent>
              <MarkerTooltip>
                {label} — {time}
              </MarkerTooltip>
              <MarkerPopup>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">
                    {isFirst ? "🟢 Starting Point" : isLast ? "🔴 Ending Point" : `Route Point ${point.sequence}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Time: {time}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {point?.lat.toFixed(4)}, {point?.lng.toFixed(4)}
                  </p>
                </div>
              </MarkerPopup>
            </MapMarker>
          );
        })}
      </Map>
    </div>
  );
}
