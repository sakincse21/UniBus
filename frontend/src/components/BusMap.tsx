/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  Map,
  MapMarker,
  MapRoute,
  MapControls,
  MarkerContent,
  MarkerPopup,
  MarkerTooltip,
  useMap,
} from "@/components/ui/map";
import { useEffect, useMemo, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";
import type { IRoutePoint } from "@/lib/interfaces";

// Auto-centers the map on the user's current GPS location when the map first loads.
function AutoLocate() {
  const { map, isLoaded } = useMap();
  const fired = useRef(false);
  useEffect(() => {
    if (!isLoaded || !map || fired.current) return;
    fired.current = true;
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          map.flyTo({
            center: [pos.coords.longitude, pos.coords.latitude],
            zoom: 13,
            duration: 1200,
          });
        },
        () => {}
      );
    }
  }, [isLoaded, map]);
  return null;
}

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
  const m = Math.floor(totalMin % 60);
  return to12h(
    `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
  );
}

function interpolatePosition(
  p1: { lat: number; lng: number },
  p2: { lat: number; lng: number },
  ratio: number,
): { lat: number; lng: number } {
  return {
    lat: p1.lat + (p2.lat - p1.lat) * ratio,
    lng: p1.lng + (p2.lng - p1.lng) * ratio,
  };
}

function calculateEstimatedPosition(
  routePoints: IRoutePoint[],
  startTime: string | null,
): { lat: number; lng: number } | null {
  if (!routePoints || routePoints.length === 0 || !startTime) return null;

  const [sh, sm] = startTime.split(":").map(Number);
  const startMin = sh * 60 + sm;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const elapsed = nowMin - startMin;

  if (elapsed < 0) {
    return { lat: routePoints[0].lat, lng: routePoints[0].lng };
  }

  const lastOffset = routePoints[routePoints.length - 1].minuteOffset;
  if (elapsed > lastOffset) {
    return null;
  }

  for (let i = 0; i < routePoints.length - 1; i++) {
    const p1 = routePoints[i];
    const p2 = routePoints[i + 1];

    if (elapsed >= p1.minuteOffset && elapsed <= p2.minuteOffset) {
      const segmentDuration = p2.minuteOffset - p1.minuteOffset;
      const ratio =
        segmentDuration > 0 ? (elapsed - p1.minuteOffset) / segmentDuration : 0;

      return interpolatePosition(p1, p2, ratio);
    }
  }

  return { lat: routePoints[0].lat, lng: routePoints[0].lng };
}

// Normalize route points if offsets seem incorrect (all 0 or missing)
function normalizeRoutePoints(pts: any[]): any[] {
  if (!pts || pts.length === 0) return pts;
  
  // Check if all offsets are 0 or the same
  const offsets = pts.map((p) => p.minuteOffset ?? 0);
  const uniqueOffsets = new Set(offsets.filter((o) => o !== undefined && o !== null));
  
  // If all offsets are 0 or missing, auto-generate them
  if (uniqueOffsets.size === 0 || (uniqueOffsets.size === 1 && offsets[0] === 0)) {
    console.warn("🔧 Auto-generating minuteOffsets for route points (original offsets were all 0)");
    return pts.map((p, idx) => ({
      ...p,
      minuteOffset: idx * 5, // 5 minutes spacing between points
    }));
  }
  
  return pts;
}


export default function BusMap({
  points,
  startTime,
  routeId,
  activeBusId,
}: {
  points: any[];
  startTime?: string | null;
  routeId?: number | null;
  activeBusId?: number | null;
}) {
  const [locations, setLocations] = useState<Record<number, BusLocation>>({});
  const normalizedPoints = useMemo(
    () => normalizeRoutePoints(points) as IRoutePoint[],
    [points],
  );
  const route = useMemo(
    () => normalizedPoints.map((p) => [p.lng, p.lat] as [number, number]),
    [normalizedPoints],
  );
  const activeLocationIsLive = activeBusId
    ? locations[activeBusId]?.isLive === true
    : false;

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
  
  
  useEffect(() => {
    // When route is displayed, join the route room to receive live bus location updates
    let socket: any;
    
    if (routeId || activeBusId) {
      (async () => {
        try {
          socket = await getSocket();
          socket.emit("view_bus_route", {
            routeId: routeId || undefined,
            busId: activeBusId || undefined,
          });
          console.log(
            "Joined tracking room:",
            routeId ? `route:${routeId}` : `bus:${activeBusId}`,
          );
        } catch (error) {
          console.error("Failed to join route room:", error);
        }
      })();
    }
    
    return () => {
      if (socket && (routeId || activeBusId)) {
        socket.emit("leave_bus_route", {
          routeId: routeId || undefined,
          busId: activeBusId || undefined,
        });
      }
    };
  }, [routeId, activeBusId]);

  useEffect(() => {
    // Debug: Log the structure of received points
    if (normalizedPoints && normalizedPoints.length > 0) {
      console.log("BusMap received points:", normalizedPoints);
      console.log("First point keys:", Object.keys(normalizedPoints[0]));
      console.log("First point minuteOffset:", normalizedPoints[0].minuteOffset);
      console.log("All points minuteOffsets:", normalizedPoints.map((p: any) => p.minuteOffset));
      
      // Check if all minuteOffsets are the same (bug indicator)
      const offsets = normalizedPoints.map((p: any) => p.minuteOffset);
      const uniqueOffsets = new Set(offsets);
      if (uniqueOffsets.size === 1) {
        console.warn("⚠️ All points have the same minuteOffset. They might not have been set properly.");
        console.warn("Current minuteOffset value:", offsets[0]);
      }
    }
  }, [normalizedPoints]);

  useEffect(() => {
    if (!activeBusId || normalizedPoints.length === 0 || !startTime) {
      return;
    }

    if (activeLocationIsLive) {
      return;
    }

    const updateEstimate = () => {
      const estimatedPos = calculateEstimatedPosition(normalizedPoints, startTime);
      if (!estimatedPos) return;

      setLocations((prev) => ({
        ...prev,
        [activeBusId]: {
          busId: activeBusId,
          points: [],
          isLive: false,
          estimate: {
            lat: estimatedPos.lat,
            lng: estimatedPos.lng,
            confidence: prev[activeBusId]?.estimate.confidence ?? 0.5,
          },
        },
      }));
    };

    updateEstimate();
    const interval = window.setInterval(updateEstimate, 1000);

    return () => window.clearInterval(interval);
  }, [activeBusId, activeLocationIsLive, normalizedPoints, startTime]);

  // Listen for tracking ended — fallback to estimated bus location
  useEffect(() => {
    const handler = (e: any) => {
      const data = e.detail;
      if (data?.busId) {
        const estimatedPos =
          data.busId === activeBusId
            ? calculateEstimatedPosition(normalizedPoints, startTime ?? null)
            : null;

        if (estimatedPos) {
          setLocations((prev) => ({
            ...prev,
            [data.busId]: {
              busId: data.busId,
              points: [],
              isLive: false,
              estimate: {
                lat: estimatedPos.lat,
                lng: estimatedPos.lng,
                confidence: prev[data.busId]?.estimate.confidence ?? 0.5,
              },
            },
          }));
          return;
        }

        setLocations((prev) => {
          const next = { ...prev };
          delete next[data.busId];
          return next;
        });
      }
    };

    window.addEventListener("BUS_TRACKING_ENDED", handler);
    return () => window.removeEventListener("BUS_TRACKING_ENDED", handler);
  }, [activeBusId, normalizedPoints, startTime]);

  return (
    <div className="w-full h-[600px] rounded border ">
      <Map center={[89.5, 22.9]} zoom={12}>
        <AutoLocate />
        <MapControls showZoom showLocate position="bottom-right" />
        <MapRoute coordinates={route} color="#3b82f6" width={4} opacity={0.8} />
        {Object.values(locations).map((bus) => (
          <MapMarker
            key={bus?.busId}
            latitude={bus?.estimate.lat}
            longitude={bus?.estimate.lng}
          >
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
        {normalizedPoints?.map((point, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === points.length - 1;
          const time = pointTime(startTime ?? null, point.minuteOffset);

          // Color: green for start, red for end, blue for intermediate
          const bgColor = isFirst
            ? "bg-green-600"
            : isLast
              ? "bg-red-600"
              : "bg-blue-500";

          const label = isFirst
            ? "Start"
            : isLast
              ? "End"
              : `#${point.sequence}`;

          return (
            <MapMarker
              key={point.sequence}
              latitude={point.lat}
              longitude={point.lng}
            >
              <MarkerContent>
                <div className="flex flex-col items-center gap-0.5 ">
                  <span
                    className={`text-[10px] font-semibold text-foreground bg-background/80 px-1 rounded shadow`}
                  >
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
                    {isFirst
                      ? "🟢 Starting Point"
                      : isLast
                        ? "🔴 Ending Point"
                        : `Route Point ${point.sequence}`}
                  </p>
                  <p className="text-xs text-muted-foreground">Time: {time}</p>
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
