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
import { BusFront } from "lucide-react";

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

const MAP_MARKER_COLORS = {
  routePoint: "#2563EB",
  start: "#22C55E",
  end: "#EF4444",
  liveBus: "#16A34A",
  estimatedBus: "#F97316",
};

const TRACK_ROUTE_PADDING = 84;

function getRouteBounds(route: [number, number][]) {
  if (route.length === 0) return null;

  let minLng = route[0][0];
  let minLat = route[0][1];
  let maxLng = route[0][0];
  let maxLat = route[0][1];

  route.forEach(([pointLng, pointLat]) => {
    minLng = Math.min(minLng, pointLng);
    minLat = Math.min(minLat, pointLat);
    maxLng = Math.max(maxLng, pointLng);
    maxLat = Math.max(maxLat, pointLat);
  });

  return { minLng, minLat, maxLng, maxLat };
}

function getAdaptiveTrackZoom(span: number) {
  if (span <= 0.0015) return 16.2;
  if (span <= 0.003) return 15.8;
  if (span <= 0.006) return 15.2;
  if (span <= 0.012) return 14.6;
  if (span <= 0.025) return 14.0;
  if (span <= 0.05) return 13.4;
  return 12.8;
}

function TrackBusViewport({
  activeBusId,
  locations,
  route,
}: {
  activeBusId: number | null;
  locations: Record<number, BusLocation>;
  route: [number, number][];
}) {
  const { map, isLoaded } = useMap();
  const lastActiveBusRef = useRef<number | null>(null);
  const centeredRouteForRef = useRef<number | null>(null);
  const centeredLocationForRef = useRef<number | null>(null);

  useEffect(() => {
    if (lastActiveBusRef.current === activeBusId) return;
    lastActiveBusRef.current = activeBusId;
    centeredRouteForRef.current = null;
    centeredLocationForRef.current = null;
  }, [activeBusId]);

  useEffect(() => {
    if (!isLoaded || !map || activeBusId === null) return;

    const location = locations[activeBusId];
    const lat = Number(location?.estimate?.lat);
    const lng = Number(location?.estimate?.lng);
    const routeBounds = getRouteBounds(route);

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      if (centeredLocationForRef.current === activeBusId) return;

      if (routeBounds) {
        const minLng = Math.min(routeBounds.minLng, lng);
        const minLat = Math.min(routeBounds.minLat, lat);
        const maxLng = Math.max(routeBounds.maxLng, lng);
        const maxLat = Math.max(routeBounds.maxLat, lat);
        const span = Math.max(maxLng - minLng, maxLat - minLat);

        if (span < 0.0002) {
          map.flyTo({
            center: [lng, lat],
            zoom: 16,
            duration: 900,
            essential: true,
          });
        } else {
          map.fitBounds(
            [
              [minLng, minLat],
              [maxLng, maxLat],
            ],
            {
              padding: TRACK_ROUTE_PADDING,
              duration: 900,
              maxZoom: getAdaptiveTrackZoom(span),
              essential: true,
            },
          );
        }
      } else {
        map.flyTo({
          center: [lng, lat],
          zoom: 15.6,
          duration: 900,
          essential: true,
        });
      }

      centeredLocationForRef.current = activeBusId;
      return;
    }

    if (centeredRouteForRef.current === activeBusId || route.length < 2 || !routeBounds) {
      return;
    }

    const routeSpan = Math.max(
      routeBounds.maxLng - routeBounds.minLng,
      routeBounds.maxLat - routeBounds.minLat,
    );

    if (routeSpan < 0.0002) {
      map.flyTo({
        center: [routeBounds.minLng, routeBounds.minLat],
        zoom: 15,
        duration: 900,
        essential: true,
      });

      centeredRouteForRef.current = activeBusId;
      return;
    }

    map.fitBounds(
      [
        [routeBounds.minLng, routeBounds.minLat],
        [routeBounds.maxLng, routeBounds.maxLat],
      ],
      {
        padding: TRACK_ROUTE_PADDING,
        duration: 900,
        maxZoom: getAdaptiveTrackZoom(routeSpan),
        essential: true,
      }
    );

    centeredRouteForRef.current = activeBusId;
  }, [activeBusId, isLoaded, locations, map, route]);

  return null;
}

type BusLocation = {
  busId: number;
  busNumber?: string | null;
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

function StopMarker({
  type,
  time,
  sequence,
}: {
  type: "start" | "end" | "mid";
  time: string;
  sequence: number;
}) {
  const markerColor =
    type === "start"
      ? MAP_MARKER_COLORS.start
      : type === "end"
        ? MAP_MARKER_COLORS.end
        : MAP_MARKER_COLORS.routePoint;

  const borderColor =
    type === "start" ? "#86EFAC" : type === "end" ? "#FCA5A5" : "#93C5FD";

  const markerLabel = type === "start" ? "S" : type === "end" ? "E" : String(sequence);
  const markerSize = type === "mid" ? 20 : 24;

  return (
    <div className="flex flex-col items-center">
      <div className="mb-1 min-w-[52px] rounded border border-border bg-background px-1.5 py-0.5 text-center text-[10px] font-semibold text-foreground shadow-sm">
        {time}
      </div>
      <div
        className="flex items-center justify-center rounded-full border-2 text-white shadow"
        style={{
          width: markerSize,
          height: markerSize,
          backgroundColor: markerColor,
          borderColor,
          fontSize: type === "mid" ? 10 : 11,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        {markerLabel}
      </div>
    </div>
  );
}

function BusMarkerDot({ isLive }: { isLive: boolean }) {
  const markerColor = isLive
    ? MAP_MARKER_COLORS.liveBus
    : MAP_MARKER_COLORS.estimatedBus;

  return (
    <div
      className="flex h-8 w-8 items-center justify-center rounded-full border border-white/80 shadow"
      style={{ backgroundColor: markerColor }}
    >
      <BusFront className="h-4 w-4 text-white" />
    </div>
  );
}


export default function BusMap({
  points,
  startTime,
  routeId,
  activeBusId,
  busNumberById,
}: {
  points: any[];
  startTime?: string | null;
  routeId?: number | null;
  activeBusId?: number | null;
  busNumberById?: Record<number, string>;
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
          busNumber:
            typeof data.busNumber === "string" && data.busNumber.trim().length > 0
              ? data.busNumber.trim()
              : prev[data.busId]?.busNumber || busNumberById?.[data.busId] || null,
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
  }, [busNumberById]);

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
              busNumber:
                typeof data.busNumber === "string" && data.busNumber.trim().length > 0
                  ? data.busNumber.trim()
                  : prev[data.busId]?.busNumber || busNumberById?.[data.busId] || null,
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
  }, [busNumberById]);
  
  
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
          busNumber: prev[activeBusId]?.busNumber || busNumberById?.[activeBusId] || null,
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
  }, [activeBusId, activeLocationIsLive, busNumberById, normalizedPoints, startTime]);

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
              busNumber: prev[data.busId]?.busNumber || busNumberById?.[data.busId] || null,
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
  }, [activeBusId, busNumberById, normalizedPoints, startTime]);

  return (
    <div className="h-[620px] w-full overflow-hidden rounded-md border border-border bg-background">
      <Map center={[89.5, 22.9]} zoom={12.5}>
        <AutoLocate />
        <TrackBusViewport
          activeBusId={activeBusId ?? null}
          locations={locations}
          route={route}
        />
        <MapControls showZoom showLocate position="bottom-right" />
        <MapRoute coordinates={route} color={MAP_MARKER_COLORS.routePoint} width={4} opacity={1} />
        {Object.values(locations).map((bus) => {
          if (
            !bus?.estimate ||
            typeof bus.estimate.lat !== "number" ||
            typeof bus.estimate.lng !== "number"
          ) {
            return null;
          }
          
          return (
          <MapMarker
            key={bus?.busId}
            latitude={bus?.estimate.lat}
            longitude={bus?.estimate.lng}
          >
            <MarkerContent>
              <BusMarkerDot isLive={bus.isLive} />
            </MarkerContent>
            {(() => {
              const resolvedBusNumber =
                bus.busNumber && bus.busNumber.trim().length > 0
                  ? bus.busNumber.trim()
                  : busNumberById?.[bus.busId] || "";
              const busLabel = `Bus ${resolvedBusNumber || bus.busId}`;

              return (
                <>
            <MarkerTooltip>
                  {busLabel} {bus.isLive ? "(Live)" : "(Estimated)"}
            </MarkerTooltip>
            <MarkerPopup>
              <div className="space-y-1">
                <p className="font-medium text-foreground">
                      {busLabel} — {bus.isLive ? "Live" : "Estimated"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {bus.estimate.lat.toFixed(4)}, {bus.estimate.lng.toFixed(4)}
                </p>
              </div>
            </MarkerPopup>
                </>
              );
            })()}
          </MapMarker>
        )})}
        {normalizedPoints?.map((point, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === normalizedPoints.length - 1;
          const markerType = isFirst ? "start" : isLast ? "end" : "mid";
          const time = pointTime(startTime ?? null, point.minuteOffset);

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
                <StopMarker
                  type={markerType}
                  time={time}
                  sequence={point.sequence}
                />
              </MarkerContent>
              <MarkerTooltip>
                {label} — {time}
              </MarkerTooltip>
              <MarkerPopup>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">
                    {isFirst
                      ? "Starting Point"
                      : isLast
                        ? "Ending Point"
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
