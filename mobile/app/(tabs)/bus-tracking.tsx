import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import BottomSheet, {
  BottomSheetFlatList,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import {
  Map,
  MapMarker,
  MapRoute,
  MapUserLocation,
  MarkerContent,
  MarkerPopup,
  type MapRefHandle,
} from "../../components/ui/map";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { busAPI, locationAPI } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type {
  IBus,
  IBusLiveLocation,
  IBusTrackingResponse,
  IRoutePoint,
} from "@/interfaces";
import type { Socket } from "socket.io-client";
import { useBusTrackingStore } from "@/store/busTrackingStore";
import { APP_THEME_COLORS } from "@/lib/theme";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const DEFAULT_REGION = {
  latitude: 22.9,
  longitude: 89.5,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const TRACKING_FOCUS_PADDING_FACTOR = 1.35;
const TRACKING_FOCUS_MIN_DELTA = 0.006;
const TRACKING_FOCUS_MAX_DELTA = 0.06;
const TRACKING_FOCUS_SINGLE_POINT_DELTA = 0.012;
const SHARING_ESTIMATED_POINT_MAX_DISTANCE_METERS = 500;
const EARTH_RADIUS_METERS = 6371000;

const COLORS = APP_THEME_COLORS;
const MAP_MARKER_COLORS = {
  routePoint: "#2563EB",
  start: "#22C55E",
  end: "#EF4444",
  liveBus: "#16A34A",
  estimatedBus: "#F97316",
};

function deltaToZoom(longitudeDelta: number): number {
  const safeDelta = Math.max(longitudeDelta, 0.0001);
  return Math.max(0, Math.min(20, Math.log2(360 / safeDelta)));
}

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
    `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`,
  );
}

function toFiniteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function normalizeRoutePoints(points: unknown): IRoutePoint[] {
  if (!Array.isArray(points)) return [];

  return points
    .map((point, index) => {
      const raw = point as Partial<IRoutePoint>;
      const lat = toFiniteNumber(raw.lat);
      const lng = toFiniteNumber(raw.lng);
      const minuteOffset = toFiniteNumber(raw.minuteOffset);

      if (lat === null || lng === null || minuteOffset === null) {
        return null;
      }

      const sequence = toFiniteNumber(raw.sequence);

      return {
        sequence: sequence === null ? index + 1 : Math.round(sequence),
        lat,
        lng,
        minuteOffset,
      };
    })
    .filter((point): point is IRoutePoint => point !== null);
}

type TrackingFocusPoint = {
  lat: number;
  lng: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildTrackingFocusRegion(
  routePoints: IRoutePoint[],
  focusPoint?: TrackingFocusPoint | null,
) {
  const coordinates: TrackingFocusPoint[] = [
    ...routePoints.map((point) => ({ lat: point.lat, lng: point.lng })),
  ];

  if (focusPoint) {
    coordinates.push(focusPoint);
  }

  if (coordinates.length === 0) {
    return null;
  }

  let minLat = coordinates[0].lat;
  let maxLat = coordinates[0].lat;
  let minLng = coordinates[0].lng;
  let maxLng = coordinates[0].lng;

  coordinates.forEach((point) => {
    minLat = Math.min(minLat, point.lat);
    maxLat = Math.max(maxLat, point.lat);
    minLng = Math.min(minLng, point.lng);
    maxLng = Math.max(maxLng, point.lng);
  });

  const routeCenterLat = (minLat + maxLat) / 2;
  const routeCenterLng = (minLng + maxLng) / 2;
  const latitude = focusPoint
    ? routeCenterLat * 0.45 + focusPoint.lat * 0.55
    : routeCenterLat;
  const longitude = focusPoint
    ? routeCenterLng * 0.45 + focusPoint.lng * 0.55
    : routeCenterLng;

  const latSpan = maxLat - minLat;
  const lngSpan = maxLng - minLng;
  const rawSpan = Math.max(latSpan, lngSpan);

  const delta =
    rawSpan < 0.0001
      ? TRACKING_FOCUS_SINGLE_POINT_DELTA
      : clamp(
          rawSpan * TRACKING_FOCUS_PADDING_FACTOR,
          TRACKING_FOCUS_MIN_DELTA,
          TRACKING_FOCUS_MAX_DELTA,
        );

  return {
    latitude,
    longitude,
    latitudeDelta: delta,
    longitudeDelta: delta,
  };
}

/**
 * Linear interpolation between two coordinates
 */
function interpolatePosition(
  p1: { lat: number; lng: number },
  p2: { lat: number; lng: number },
  ratio: number
): { lat: number; lng: number } {
  return {
    lat: p1.lat + (p2.lat - p1.lat) * ratio,
    lng: p1.lng + (p2.lng - p1.lng) * ratio,
  };
}

/**
 * Calculate estimated bus position based on current time and route points
 */
function calculateEstimatedPosition(
  routePoints: IRoutePoint[],
  startTime: string | null
): { lat: number; lng: number } | null {
  if (!routePoints || routePoints.length === 0 || !startTime) return null;

  // Parse start time (HH:mm format)
  const [sh, sm] = startTime.split(":").map(Number);
  const startMin = sh * 60 + sm;

  // Calculate current time in minutes
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

  // Calculate elapsed time since route start
  const elapsed = nowMin - startMin;

  // If before route start, return first point
  if (elapsed < 0) {
    return { lat: routePoints[0].lat, lng: routePoints[0].lng };
  }

  // If after route end, don't show estimated location anymore
  const lastOffset = routePoints[routePoints.length - 1].minuteOffset;
  if (elapsed > lastOffset) {
    return null;
  }

  // Find which two points the bus is between
  for (let i = 0; i < routePoints.length - 1; i++) {
    const p1 = routePoints[i];
    const p2 = routePoints[i + 1];

    if (elapsed >= p1.minuteOffset && elapsed <= p2.minuteOffset) {
      // Calculate interpolation ratio (0 = at p1, 1 = at p2)
      const segmentDuration = p2.minuteOffset - p1.minuteOffset;
      const ratio =
        segmentDuration > 0 ? (elapsed - p1.minuteOffset) / segmentDuration : 0;

      // Interpolate position
      return interpolatePosition(p1, p2, ratio);
    }
  }

  return { lat: routePoints[0].lat, lng: routePoints[0].lng };
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
  const bgColor =
    type === "start"
      ? MAP_MARKER_COLORS.start
      : type === "end"
        ? MAP_MARKER_COLORS.end
        : MAP_MARKER_COLORS.routePoint;
  const markerLabel =
    type === "start" ? "S" : type === "end" ? "E" : String(sequence);
  const markerSize = type === "start" || type === "end" ? 24 : 20;

  return (
    <View
      style={{
        alignItems: "center",
      }}
    >
      <View
        style={{
          backgroundColor: COLORS.surface,
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 6,
          marginBottom: 4,
          minWidth: 52,
          alignItems: "center",
          borderWidth: 1,
          borderColor: COLORS.outline,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.08,
          shadowRadius: 2,
          elevation: 1,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            color: COLORS.onSurface,
            fontSize: 10,
            fontWeight: "700",
            textAlign: "center",
          }}
        >
          {time}
        </Text>
      </View>

      <View
        style={{
          width: markerSize,
          height: markerSize,
          borderRadius: markerSize / 2,
          backgroundColor: bgColor,
          borderWidth: 2,
          borderColor:
            type === "start"
              ? "#86EFAC"
              : type === "end"
                ? "#FCA5A5"
                : "#93C5FD",
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.12,
          shadowRadius: 3,
          elevation: 2,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            color: "#fff",
            fontSize: type === "mid" ? 9 : 11,
            fontWeight: "700",
            textAlign: "center",
          }}
        >
          {markerLabel}
        </Text>
      </View>
    </View>
  );
}

function BusMarkerDot({
  isLive,
}: {
  isLive: boolean;
}) {
  const color = isLive ? MAP_MARKER_COLORS.liveBus : MAP_MARKER_COLORS.estimatedBus;

  return (
    <View style={[styles.busMarkerWrap, { backgroundColor: color }]}>
      <MaterialCommunityIcons name="bus" size={16} color="#FFFFFF" />
    </View>
  );
}

export default function BusTrackingTab() {
  const insets = useSafeAreaInsets();

  const [buses, setBuses] = useState<IBus[]>([]);
  const [activeBusId, setActiveBusId] = useState<number | null>(null);
  const [busLocations, setBusLocations] = useState<
    Record<number, IBusLiveLocation>
  >({});
  const [routePoints, setRoutePoints] = useState<IRoutePoint[]>([]);
  const [activeRouteId, setActiveRouteId] = useState<number | null>(null);
  const [scheduleStartTime, setScheduleStartTime] = useState<string | null>(
    null,
  );
  const [loadingBuses, setLoadingBuses] = useState(true);
  const [trackingBusId, setTrackingBusId] = useState<number | null>(null);
  const [volunteerShareBusId, setVolunteerShareBusId] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [isSocketReady, setIsSocketReady] = useState(false);

  const [isSharingGps, setIsSharingGps] = useState(false);
  const [sharingForBusId, setSharingForBusId] = useState<number | null>(null);
  const [userGpsLocation, setUserGpsLocation] = useState<{ lat: number; lng: number } | null>(null);
  const isSharingRef = useRef(false);
  const sharingBusIdRef = useRef<number | null>(null);
  const activeBusIdRef = useRef<number | null>(null);
  const activeRouteIdRef = useRef<number | null>(null);
  const focusedBusIdRef = useRef<number | null>(null);
  const gpsSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const passiveLocationSubscriptionRef =
    useRef<Location.LocationSubscription | null>(null);
  const handledRequestIdRef = useRef<number | null>(null);
  const acceptRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const acceptRetryCountRef = useRef<Record<number, number>>({});

  const mapRef = useRef<MapRefHandle | null>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const socketRef = useRef<Socket | null>(null);
  const requestToStartSharing = useBusTrackingStore(
    (state) => state.requestToStartSharing,
  );
  const setRequestToStartSharing = useBusTrackingStore(
    (state) => state.setRequestToStartSharing,
  );
  const setSharingState = useBusTrackingStore((state) => state.setSharingState);

  const snapPoints = useMemo(() => ["15%", "45%", "85%"], []);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }, []);

  const stopSharingGps = useCallback(
    async (reason?: string) => {
      gpsSubscriptionRef.current?.remove();
      gpsSubscriptionRef.current = null;
      const busId = sharingBusIdRef.current;
      isSharingRef.current = false;
      sharingBusIdRef.current = null;
      setIsSharingGps(false);
      setSharingForBusId(null);
      setSharingState(false, null);
      setUserGpsLocation(null);
      if (busId && socketRef.current) {
        socketRef.current.emit("stop_tracking", { busId });
      }
      if (reason) showToast(reason);
    },
    [showToast],
  );

  const joinTrackingRoom = useCallback((busId: number, routeId?: number | null) => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.emit("view_bus_route", {
      busId,
      routeId: routeId ?? undefined,
    });
  }, []);

  const focusTrackingViewport = useCallback(
    (
      route: IRoutePoint[],
      focusPoint?: TrackingFocusPoint | null,
      duration = 900,
    ) => {
      const region = buildTrackingFocusRegion(route, focusPoint);
      if (!region) return;
      mapRef.current?.animateToRegion(region, duration);
    },
    [],
  );

  const leaveTrackingRoom = useCallback((busId?: number | null, routeId?: number | null) => {
    const socket = socketRef.current;
    if (!socket || !busId) return;

    socket.emit("leave_bus_route", {
      busId,
      routeId: routeId ?? undefined,
    });
  }, []);

  const syncSharedBusRoute = useCallback(
    async (busId: number) => {
      try {
        if (activeBusId === busId && routePoints.length > 0) {
          joinTrackingRoom(busId, activeRouteIdRef.current);
          return;
        }

        if (activeBusId && activeBusId !== busId) {
          leaveTrackingRoom(activeBusId, activeRouteIdRef.current);
        }

        const res = await busAPI.requestTracking(busId);
        const data = res.data as IBusTrackingResponse;
        const normalizedPoints = normalizeRoutePoints(data.points);

        setActiveBusId(busId);
        setActiveRouteId(data.routeId ?? null);
        activeRouteIdRef.current = data.routeId ?? null;
        focusedBusIdRef.current = null;
        setRoutePoints(normalizedPoints);
        setScheduleStartTime(data.startTime ?? null);
        joinTrackingRoom(busId, data.routeId ?? null);

        const estimateLat = toFiniteNumber(data.estimate?.lat);
        const estimateLng = toFiniteNumber(data.estimate?.lng);

        if (estimateLat !== null && estimateLng !== null) {
          setBusLocations((prev) => ({
            ...prev,
            [busId]: {
              busId,
              lat: estimateLat,
              lng: estimateLng,
              isLive: data.isLive ?? false,
              confidence:
                data.estimate?.confidence ?? prev[busId]?.confidence ?? 0.5,
            },
          }));

          focusTrackingViewport(normalizedPoints, {
            lat: estimateLat,
            lng: estimateLng,
          });
          focusedBusIdRef.current = busId;
        } else {
          focusTrackingViewport(normalizedPoints);
        }

        bottomSheetRef.current?.snapToIndex(0);
      } catch (error) {
        console.warn("Failed to load bus route while sharing:", error);
      }
    },
    [
      activeBusId,
      focusTrackingViewport,
      joinTrackingRoom,
      leaveTrackingRoom,
      routePoints.length,
    ],
  );

  const getEstimatedPointForBus = useCallback(
    async (busId: number): Promise<{ lat: number; lng: number } | null> => {
      const live = busLocations[busId];
      const liveLat = toFiniteNumber(live?.lat);
      const liveLng = toFiniteNumber(live?.lng);

      if (liveLat !== null && liveLng !== null) {
        return { lat: liveLat, lng: liveLng };
      }

      try {
        const response = await busAPI.requestTracking(busId);
        const data = response.data as IBusTrackingResponse;
        const estimateLat = toFiniteNumber(data.estimate?.lat);
        const estimateLng = toFiniteNumber(data.estimate?.lng);

        if (estimateLat === null || estimateLng === null) {
          return null;
        }

        return { lat: estimateLat, lng: estimateLng };
      } catch {
        return null;
      }
    },
    [busLocations],
  );

  const ensureShareEligibilityByEstimatedPoint = useCallback(
    async (busId: number, currentLocation: { lat: number; lng: number }) => {
      const estimatedPoint = await getEstimatedPointForBus(busId);
      if (!estimatedPoint) {
        showToast("Unable to verify bus estimated location. Try again.");
        return false;
      }

      const distance = distanceMeters(currentLocation, estimatedPoint);
      if (distance > SHARING_ESTIMATED_POINT_MAX_DISTANCE_METERS) {
        showToast(
          `You are ${Math.round(distance)}m away from bus estimate. Sharing is allowed within 500m only.`,
        );
        return false;
      }

      return true;
    },
    [getEstimatedPointForBus, showToast],
  );

  const waitForSocketReady = useCallback(async (timeoutMs = 10000) => {
    const socket = socketRef.current;
    if (!socket) return false;
    if (socket.connected) return true;

    return new Promise<boolean>((resolve) => {
      let settled = false;

      const cleanup = () => {
        socket.off("connect", onConnect);
        socket.off("connect_error", onConnectError);
      };

      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        cleanup();
        if (ok) {
          setIsSocketReady(true);
        }
        resolve(ok);
      };

      const onConnect = () => finish(true);
      const onConnectError = () => finish(false);

      const timeout = setTimeout(() => {
        finish(socket.connected);
      }, timeoutMs);

      socket.on("connect", onConnect);
      socket.on("connect_error", onConnectError);

      try {
        socket.connect();
      } catch {
        finish(false);
      }
    });
  }, []);

  const acceptTracking = useCallback(
    async (busId: number, requestId?: number | null) => {
      const socket = socketRef.current;
      if (!socket) {
        showToast("Connection is not ready yet");
        return false;
      }

      const socketReady = await waitForSocketReady(10000);
      if (!socketReady) {
        showToast("Connection is not ready yet");
        return false;
      }

      if (isSharingRef.current) {
        if (sharingBusIdRef.current === busId) {
          await syncSharedBusRoute(busId);
          return true;
        }

        showToast("Stop current sharing before starting another bus");
        return false;
      }

      let sessionStarted = false;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setHasLocationPermission(false);
          showToast("Location permission required");
          return false;
        }

        setHasLocationPermission(true);

        const initialPosition = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest,
        });
        const initialLat = initialPosition.coords.latitude;
        const initialLng = initialPosition.coords.longitude;

        const canShare = await ensureShareEligibilityByEstimatedPoint(busId, {
          lat: initialLat,
          lng: initialLng,
        });

        if (!canShare) {
          return false;
        }

        const ack = await new Promise<{ ok: boolean; message?: string }>(
          (resolve) => {
            let settled = false;

            const timeout = setTimeout(() => {
              if (settled) return;
              settled = true;
              resolve({
                ok: false,
                message: "Timed out while starting sharing",
              });
            }, 5000);

            socket.emit(
              "accept_tracking",
              {
                busId,
                requestId:
                  Number.isFinite(requestId) && Number(requestId) > 0
                    ? Number(requestId)
                    : undefined,
                lat: initialLat,
                lng: initialLng,
              },
              (response?: { ok?: boolean; message?: string }) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);

                resolve({
                  ok: response?.ok === true,
                  message: response?.message,
                });
              },
            );
          },
        );

        if (!ack.ok) {
          showToast(ack.message || "Could not start sharing for this bus");
          return false;
        }

        sessionStarted = true;
        isSharingRef.current = true;
        sharingBusIdRef.current = busId;
        setIsSharingGps(true);
        setSharingForBusId(busId);
        setSharingState(true, busId);

        await syncSharedBusRoute(busId);

        await locationAPI.updateLocation(initialLat, initialLng).catch(() => {});
        socket.emit("location_update", { lat: initialLat, lng: initialLng });
        setUserGpsLocation({ lat: initialLat, lng: initialLng });

        // Send the first live point immediately so other viewers don't wait
        socket.emit("gps_update", {
          busId,
          lat: initialLat,
          lng: initialLng,
        });

        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 3000,
            distanceInterval: 5,
          },
          (pos) => {
            if (!isSharingRef.current) {
              sub.remove();
              return;
            }
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            // Store user location in state for map display
            setUserGpsLocation({ lat, lng });
            // Send to server
            socketRef.current?.emit("location_update", { lat, lng });
            socketRef.current?.emit("gps_update", {
              busId,
              lat,
              lng,
            });
          },
        );

        gpsSubscriptionRef.current = sub;
        showToast("Now sharing bus location");
        return true;
      } catch {
        if (sessionStarted) {
          socket.emit("stop_tracking", { busId });
        }
        isSharingRef.current = false;
        sharingBusIdRef.current = null;
        setIsSharingGps(false);
        setSharingForBusId(null);
        setSharingState(false, null);
        setUserGpsLocation(null);
        showToast("Failed to start GPS tracking");
        return false;
      }
    },
    [
      ensureShareEligibilityByEstimatedPoint,
      setSharingState,
      showToast,
      syncSharedBusRoute,
      waitForSocketReady,
    ],
  );

  const volunteerShareTracking = useCallback(
    async (busId: number) => {
      const socket = socketRef.current;
      if (!socket) {
        showToast("Connection is not ready yet");
        return;
      }

      const socketReady = await waitForSocketReady(10000);
      if (!socketReady) {
        showToast("Connection is not ready yet");
        return;
      }

      if (isSharingRef.current) {
        if (sharingBusIdRef.current === busId) {
          await stopSharingGps("Tracking stopped");
          return;
        }

        showToast("Stop current sharing before starting another bus");
        return;
      }

      setVolunteerShareBusId(busId);

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setHasLocationPermission(false);
          showToast("Location permission required");
          return;
        }

        setHasLocationPermission(true);

        const initialPosition = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest,
        });
        const initialLat = initialPosition.coords.latitude;
        const initialLng = initialPosition.coords.longitude;

        const canShare = await ensureShareEligibilityByEstimatedPoint(busId, {
          lat: initialLat,
          lng: initialLng,
        });

        if (!canShare) {
          return;
        }

        const ack = await new Promise<{ ok: boolean; message?: string }>(
          (resolve) => {
            let settled = false;

            const timeout = setTimeout(() => {
              if (settled) return;
              settled = true;
              resolve({
                ok: false,
                message: "Timed out while starting sharing",
              });
            }, 5000);

            socket.emit(
              "volunteer_tracking",
              { busId, lat: initialLat, lng: initialLng },
              (response?: { ok?: boolean; message?: string }) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);

                resolve({
                  ok: response?.ok === true,
                  message: response?.message,
                });
              },
            );
          },
        );

        if (!ack.ok) {
          showToast(ack.message || "Could not start sharing for this bus");
          return;
        }

        isSharingRef.current = true;
        sharingBusIdRef.current = busId;
        setIsSharingGps(true);
        setSharingForBusId(busId);
        setSharingState(true, busId);

        await syncSharedBusRoute(busId);

        await locationAPI.updateLocation(initialLat, initialLng).catch(() => {});
        socket.emit("location_update", { lat: initialLat, lng: initialLng });
        socket.emit("gps_update", {
          busId,
          lat: initialLat,
          lng: initialLng,
        });
        setUserGpsLocation({ lat: initialLat, lng: initialLng });

        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 3000,
            distanceInterval: 5,
          },
          (pos) => {
            if (!isSharingRef.current) {
              sub.remove();
              return;
            }

            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;

            setUserGpsLocation({ lat, lng });
            socketRef.current?.emit("location_update", { lat, lng });
            socketRef.current?.emit("gps_update", {
              busId,
              lat,
              lng,
            });
          },
        );

        gpsSubscriptionRef.current = sub;
        showToast("Now sharing bus location");
      } catch {
        socket.emit("stop_tracking", { busId });
        isSharingRef.current = false;
        sharingBusIdRef.current = null;
        setIsSharingGps(false);
        setSharingForBusId(null);
        setSharingState(false, null);
        setUserGpsLocation(null);
        showToast("Failed to start voluntary sharing");
      } finally {
        setVolunteerShareBusId(null);
      }
    },
    [
      ensureShareEligibilityByEstimatedPoint,
      setSharingState,
      showToast,
      stopSharingGps,
      syncSharedBusRoute,
      waitForSocketReady,
    ],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!cancelled) {
          setHasLocationPermission(status === "granted");
        }
        if (status === "granted" && !cancelled) {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          if (!cancelled) {
            mapRef.current?.animateToRegion(
              {
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
                latitudeDelta: 0.08,
                longitudeDelta: 0.08,
              },
              1200,
            );
            locationAPI
              .updateLocation(loc.coords.latitude, loc.coords.longitude)
              .catch(() => {});
          }
        }
      } catch {}

      if (!cancelled) {
        try {
          const res = await busAPI.getBuses();
          // Handle multiple response formats
          const busesData = res.data?.data || res.data || res || [];
          const busesArray = Array.isArray(busesData) ? busesData : [];
          setBuses(busesArray);
        } catch (err) {
          console.error("Error loading buses:", err);
          showToast("Failed to load buses.");
          setBuses([]);
        }
        setLoadingBuses(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showToast]);

  useEffect(() => {
    return () => {
      if (acceptRetryTimerRef.current) {
        clearTimeout(acceptRetryTimerRef.current);
        acceptRetryTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!requestToStartSharing) return;
    if (!isSocketReady || !socketRef.current) return;
    if (handledRequestIdRef.current === requestToStartSharing.id) return;

    handledRequestIdRef.current = requestToStartSharing.id;
    const pendingRequest = requestToStartSharing;

    if (
      isSharingRef.current &&
      sharingBusIdRef.current === pendingRequest.busId
    ) {
      delete acceptRetryCountRef.current[pendingRequest.id];
      setRequestToStartSharing(null);
      return;
    }

    acceptTracking(pendingRequest.busId, pendingRequest.id)
      .then((started) => {
        if (started) {
          delete acceptRetryCountRef.current[pendingRequest.id];
          if (acceptRetryTimerRef.current) {
            clearTimeout(acceptRetryTimerRef.current);
            acceptRetryTimerRef.current = null;
          }
          setRequestToStartSharing(null);
          return;
        }

        handledRequestIdRef.current = null;

        const retryCount = acceptRetryCountRef.current[pendingRequest.id] ?? 0;
        if (retryCount >= 2) {
          delete acceptRetryCountRef.current[pendingRequest.id];
          setRequestToStartSharing(null);
          showToast("Auto-start failed. Tap Share on your bus card.");
          return;
        }

        acceptRetryCountRef.current[pendingRequest.id] = retryCount + 1;

        if (acceptRetryTimerRef.current) {
          clearTimeout(acceptRetryTimerRef.current);
        }

        acceptRetryTimerRef.current = setTimeout(() => {
          const trackingStore = useBusTrackingStore.getState();
          const currentRequest = trackingStore.requestToStartSharing;

          if (!currentRequest || currentRequest.id !== pendingRequest.id) {
            return;
          }

          trackingStore.setRequestToStartSharing({ ...currentRequest });
        }, 1000 * (retryCount + 1));
      });
  }, [
    acceptTracking,
    isSocketReady,
    requestToStartSharing,
    setRequestToStartSharing,
    showToast,
  ]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (mounted) {
          setHasLocationPermission(status === "granted");
        }
        if (status !== "granted" || !mounted) return;

        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 15000,
            distanceInterval: 25,
          },
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;

            locationAPI.updateLocation(lat, lng).catch(() => {});
            socketRef.current?.emit("location_update", { lat, lng });
          },
        );

        if (!mounted) {
          sub.remove();
          return;
        }

        passiveLocationSubscriptionRef.current = sub;
      } catch {}
    })();

    return () => {
      mounted = false;
      passiveLocationSubscriptionRef.current?.remove();
      passiveLocationSubscriptionRef.current = null;
    };
  }, []);

  // Debug: Log route points updates
  useEffect(() => {
    if (routePoints.length > 0) {
      console.log(`📍 Route points updated: ${routePoints.length} points visible`);
      routePoints.forEach((pt, idx) => {
        const type = idx === 0 ? "START" : idx === routePoints.length - 1 ? "END" : `STOP ${pt.sequence}`;
        console.log(`  ${type}: (${pt.lat.toFixed(4)}, ${pt.lng.toFixed(4)}) offset: ${pt.minuteOffset}m`);
      });
    }
  }, [routePoints]);

  // Update estimated bus position every second based on elapsed time
  // Skip this if user is sharing GPS location
  useEffect(() => {
    const activeLocation = activeBusId ? busLocations[activeBusId] : null;
    if (
      activeBusId === null ||
      routePoints.length === 0 ||
      !scheduleStartTime ||
      isSharingGps ||
      activeLocation?.isLive
    ) {
      return;
    }

    const interval = setInterval(() => {
      const estimatedPos = calculateEstimatedPosition(routePoints, scheduleStartTime);
      if (estimatedPos) {
        setBusLocations((prev) => ({
          ...prev,
          [activeBusId]: {
            ...prev[activeBusId],
            lat: estimatedPos.lat,
            lng: estimatedPos.lng,
            isLive: false,
            confidence: prev[activeBusId]?.confidence ?? 0.5,
          },
        }));
      }
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, [activeBusId, routePoints, scheduleStartTime, isSharingGps, busLocations]);

  useEffect(() => {
    activeBusIdRef.current = activeBusId;
  }, [activeBusId]);

  useEffect(() => {
    let mounted = true;
    let activeSocket: Socket | null = null;

    const handleSocketConnect = () => {
      if (!mounted) return;
      setIsSocketReady(true);

      const connectedBusId = activeBusIdRef.current;
      if (connectedBusId) {
        joinTrackingRoom(connectedBusId, activeRouteIdRef.current);
        focusedBusIdRef.current = null;
      }
    };

    const handleSocketDisconnect = () => {
      if (!mounted) return;
      setIsSocketReady(false);
    };

    (async () => {
      try {
        const socket = await getSocket();
        if (!mounted) return;
        socketRef.current = socket;
        activeSocket = socket;
        setIsSocketReady(socket.connected);

        socket.on("connect", handleSocketConnect);
        socket.on("disconnect", handleSocketDisconnect);

        socket.on("bus_location_update", (data: any) => {
          if (!mounted) return;
          const busId = toFiniteNumber(data.busId);
          const lat = toFiniteNumber(data.estimate?.lat ?? data.lat);
          const lng = toFiniteNumber(data.estimate?.lng ?? data.lng);
          const confidence = toFiniteNumber(data.estimate?.confidence ?? 1) ?? 1;

          if (busId === null || lat === null || lng === null) {
            return;
          }

          setBusLocations((prev) => ({
            ...prev,
            [busId]: {
              busId,
              lat,
              lng,
              isLive: true,
              confidence,
            },
          }));

          if (activeBusId === busId && focusedBusIdRef.current !== busId) {
            focusTrackingViewport(routePoints, { lat, lng });
            focusedBusIdRef.current = busId;
          }
        });

        socket.on("tracking_started", (_data: any) => {
          if (!mounted) return;
          showToast("Live tracking confirmed");
        });

        socket.on("tracking_rejected", (_data: any) => {
          if (!mounted) return;
          stopSharingGps("Another user is already tracking this bus");
        });

        socket.on("tracking_expired", (data: any) => {
          if (!mounted) return;
          if (isSharingRef.current && sharingBusIdRef.current === data.busId) {
            stopSharingGps("Tracking session expired");
          }
        });

        socket.on("tracking_off_route", (data: any) => {
          if (!mounted) return;
          if (isSharingRef.current && sharingBusIdRef.current === data.busId) {
            stopSharingGps(
              `Off-route detected (${data.dist}m away). Tracking stopped.`,
            );
          }
        });

        socket.on("bus_tracking_ended", (data: any) => {
          const endedBusId = toFiniteNumber(data?.busId);
          if (!mounted || endedBusId === null) return;

          if (activeBusId === endedBusId) {
            const estimatedPos =
              routePoints.length > 0 && scheduleStartTime
                ? calculateEstimatedPosition(routePoints, scheduleStartTime)
                : null;

            if (estimatedPos) {
              setBusLocations((prev) => ({
                ...prev,
                [endedBusId]: {
                  busId: endedBusId,
                  lat: estimatedPos.lat,
                  lng: estimatedPos.lng,
                  isLive: false,
                  confidence: prev[endedBusId]?.confidence ?? 0.5,
                },
              }));
            } else {
              setBusLocations((prev) => {
                const next = { ...prev };
                if (next[endedBusId]) {
                  next[endedBusId] = {
                    ...next[endedBusId],
                    isLive: false,
                  };
                }
                return next;
              });
            }
          }

          if (isSharingRef.current && sharingBusIdRef.current === endedBusId) {
            stopSharingGps("Live sharing ended");
          }
        });
      } catch {}
    })();

    return () => {
      mounted = false;
      activeSocket?.off("connect", handleSocketConnect);
      activeSocket?.off("disconnect", handleSocketDisconnect);
      activeSocket?.off("bus_location_update");
      activeSocket?.off("tracking_started");
      activeSocket?.off("tracking_rejected");
      activeSocket?.off("tracking_expired");
      activeSocket?.off("tracking_off_route");
      activeSocket?.off("bus_tracking_ended");
      if (socketRef.current === activeSocket) {
        socketRef.current = null;
      }
      gpsSubscriptionRef.current?.remove();
      gpsSubscriptionRef.current = null;
    };
  }, [
    acceptTracking,
    activeBusId,
    focusTrackingViewport,
    joinTrackingRoom,
    routePoints,
    scheduleStartTime,
    showToast,
    stopSharingGps,
  ]);

  const handleTrackBus = useCallback(
    async (busId: number) => {
      if (activeBusId === busId) {
        leaveTrackingRoom(activeBusId, activeRouteIdRef.current);
        setActiveBusId(null);
        setActiveRouteId(null);
        activeRouteIdRef.current = null;
        focusedBusIdRef.current = null;
        setRoutePoints([]);
        setScheduleStartTime(null);
        setBusLocations((prev) => {
          const next = { ...prev };
          delete next[busId];
          return next;
        });
        bottomSheetRef.current?.snapToIndex(1);
        return;
      }

      setTrackingBusId(busId);

      try {
        if (activeBusId) {
          leaveTrackingRoom(activeBusId, activeRouteIdRef.current);
        }

        const res = await busAPI.requestTracking(busId);
        const data = res.data as IBusTrackingResponse;
        const normalizedPoints = normalizeRoutePoints(data.points);

        setActiveBusId(busId);
        setActiveRouteId(data.routeId ?? null);
        activeRouteIdRef.current = data.routeId ?? null;
        focusedBusIdRef.current = null;
        setRoutePoints(normalizedPoints);
        setScheduleStartTime(data.startTime ?? null);
        joinTrackingRoom(busId, data.routeId ?? null);

        // Debug logging
        console.log("🗺️ Bus tracked:", busId);
        console.log("Route points received:", normalizedPoints.length);
        console.log("Start time:", data.startTime);
        if (normalizedPoints.length > 0) {
          console.log("First point:", normalizedPoints[0]);
          console.log("Route point offsets:", normalizedPoints.map((p: any) => p.minuteOffset));
        }

        const estimate = data.estimate;
        const estimateLat = toFiniteNumber(estimate?.lat);
        const estimateLng = toFiniteNumber(estimate?.lng);
        const mode = estimate?.mode;
        const notifiedUsers = Number(data.notifiedUsers ?? 0);
        if (mode === "not_started") {
          showToast(`Bus starts at ${estimate?.startTime}`);
        } else if (mode === "ended") {
          showToast(`Route ended for today`);
        } else if (data.isLive) {
          showToast("Live tracking active");
        } else if (notifiedUsers > 0) {
          showToast(
            `Live request sent to ${notifiedUsers} rider${notifiedUsers === 1 ? "" : "s"}`,
          );
        } else if (mode === "estimated") {
          showToast("Estimated location shown (no nearby rider available)");
        }

        if (estimateLat !== null && estimateLng !== null) {
          setBusLocations((prev) => ({
            ...prev,
            [busId]: {
              busId,
              lat: estimateLat,
              lng: estimateLng,
              isLive: data.isLive ?? false,
              confidence: estimate?.confidence ?? 0.5,
            },
          }));

          focusTrackingViewport(normalizedPoints, {
            lat: estimateLat,
            lng: estimateLng,
          });
          focusedBusIdRef.current = busId;
        } else {
          focusTrackingViewport(normalizedPoints);
        }

        bottomSheetRef.current?.snapToIndex(0);
      } catch (err: any) {
        const msg = err?.response?.data?.message ?? "Failed to start tracking.";
        Alert.alert("Tracking Error", msg);
      }

      setTrackingBusId(null);
    },
    [
      activeBusId,
      focusTrackingViewport,
      joinTrackingRoom,
      leaveTrackingRoom,
      showToast,
    ],
  );

  const polylineCoords = useMemo(
    () => routePoints.map((p): [number, number] => [p.lng, p.lat]),
    [routePoints],
  );

  const activeBusLocation = activeBusId ? busLocations[activeBusId] : null;
  const activeBus = buses.find((b) => b.id === activeBusId);

  const renderBusCard = useCallback(
    ({ item }: { item: IBus }) => {
      const isActive = activeBusId === item.id;
      const loc = busLocations[item.id];
      const isLoading = trackingBusId === item.id;
      const isStartingShare = volunteerShareBusId === item.id;
      const isSharingThisBus = isSharingGps && sharingForBusId === item.id;
      const isSharingAnotherBus =
        isSharingGps && sharingForBusId !== null && sharingForBusId !== item.id;
      const isShareDisabled = isSharingThisBus
        ? false
        : !isSocketReady || volunteerShareBusId !== null || isSharingAnotherBus;
      const statusTone = !loc ? "idle" : loc.isLive ? "live" : "estimated";

      return (
        <View style={[styles.busCard, isActive && styles.busCardActive]}>
          <View style={styles.busCardInfo}>
            <View style={styles.busNumberContainer}>
              <Text
                style={[styles.busNumber, isActive && styles.busNumberActive]}
              >
                {item.busNumber}
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                statusTone === "live"
                  ? styles.statusLive
                  : statusTone === "estimated"
                    ? styles.statusEstimated
                    : styles.statusIdle,
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  statusTone === "live"
                    ? styles.dotGreen
                    : statusTone === "estimated"
                      ? styles.dotYellow
                      : styles.dotGray,
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  statusTone === "live"
                    ? styles.statusLiveText
                    : statusTone === "estimated"
                      ? styles.statusEstimatedText
                      : styles.statusIdleText,
                ]}
              >
                {statusTone === "live"
                  ? "Live"
                  : statusTone === "estimated"
                    ? "Est."
                    : "Idle"}
              </Text>
            </View>
          </View>
          <View style={styles.busCardActions}>
            <TouchableOpacity
              style={[styles.trackButton, isActive && styles.trackButtonActive]}
              onPress={() => handleTrackBus(item.id)}
              disabled={!isActive && trackingBusId !== null}
            >
              {isLoading ? (
                <ActivityIndicator
                  size="small"
                  color={isActive ? COLORS.danger : "#FFFFFF"}
                />
              ) : (
                <Text
                  style={[
                    styles.trackButtonText,
                    isActive && styles.trackButtonTextActive,
                  ]}
                >
                  {isActive ? "Stop" : "Track"}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.shareButton,
                isSharingThisBus
                  ? styles.shareButtonStop
                  : styles.shareButtonStart,
                isShareDisabled && styles.shareButtonDisabled,
              ]}
              onPress={() => {
                if (isSharingThisBus) {
                  stopSharingGps("Tracking stopped");
                  return;
                }
                volunteerShareTracking(item.id);
              }}
              disabled={isShareDisabled}
            >
              {isStartingShare ? (
                <ActivityIndicator
                  size="small"
                  color={isSharingThisBus ? COLORS.danger : "#FFFFFF"}
                />
              ) : (
                <Text
                  style={[
                    styles.shareButtonText,
                    isSharingThisBus && styles.shareButtonTextStop,
                  ]}
                >
                  {isSharingThisBus ? "Stop Share" : "Share"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [
      activeBusId,
      busLocations,
      handleTrackBus,
      isSharingGps,
      isSocketReady,
      sharingForBusId,
      stopSharingGps,
      trackingBusId,
      volunteerShareBusId,
      volunteerShareTracking,
    ],
  );

  return (
    <View style={styles.container}>
      <Map
        ref={mapRef}
        className="absolute inset-0"
        center={[DEFAULT_REGION.longitude, DEFAULT_REGION.latitude]}
        zoom={deltaToZoom(DEFAULT_REGION.longitudeDelta)}
        showLoader={false}
      >
        <MapUserLocation
          visible={hasLocationPermission}
          autoRequestPermission={false}
        />
        {polylineCoords.length > 1 && (
          <MapRoute
            coordinates={polylineCoords}
            color={COLORS.primary}
            width={4}
            opacity={1}
          />
        )}

        {routePoints.map((pt, idx) => {
          const type =
            idx === 0
              ? "start"
              : idx === routePoints.length - 1
                ? "end"
                : "mid";

          // Calculate time at this point: startTime + minuteOffset
          const time = pointTime(scheduleStartTime, pt.minuteOffset);

          return (
            <MapMarker
              key={`stop-${pt.sequence}`}
              coordinate={[pt.lng, pt.lat]}
              anchor={{ x: 0.5, y: 1 }}
              allowOverlap
            >
              <MarkerContent>
                <StopMarker
                  type={type}
                  time={time}
                  sequence={pt.sequence}
                />
              </MarkerContent>
            </MapMarker>
          );
        })}

        {Object.values(busLocations).map((loc) => {
          const isSharerMarker =
            isSharingGps &&
            userGpsLocation &&
            sharingForBusId != null &&
            loc.busId === sharingForBusId;
          const displayLoc = isSharerMarker && userGpsLocation ? userGpsLocation : loc;

          const markerDescription = isSharerMarker
            ? "Your location (sharing)"
            : loc.isLive
              ? "Live location"
              : "Estimated location";
          
          return (
            <MapMarker
              key={`bus-${loc.busId}`}
              coordinate={[displayLoc.lng, displayLoc.lat]}
              anchor={{ x: 0.5, y: 0.5 }}
              allowOverlap
            >
              <MarkerContent>
                <BusMarkerDot
                  isLive={isSharerMarker ? true : loc.isLive}
                />
              </MarkerContent>
              <MarkerPopup
                title={`Bus ${buses.find((b) => b.id === loc.busId)?.busNumber ?? loc.busId}`}
              >
                <Text style={styles.markerPopupText}>{markerDescription}</Text>
              </MarkerPopup>
            </MapMarker>
          );
        })}
      </Map>

      <View
        pointerEvents="none"
        style={[styles.headerOverlay, { top: insets.top + 12 }]}
      >
        <View style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            <Text style={styles.headerTitle}>Bus Tracking</Text>
            <View
              style={[
                styles.liveBadge,
                activeBusLocation
                  ? isSharingGps
                    ? styles.liveBadgeGreen
                    : activeBusLocation.isLive
                      ? styles.liveBadgeGreen
                      : styles.liveBadgeYellow
                  : styles.liveBadgeNeutral,
              ]}
            >
              <View
                style={[
                  styles.liveDot,
                  activeBusLocation
                    ? isSharingGps
                      ? styles.liveDotGreen
                      : activeBusLocation.isLive
                        ? styles.liveDotGreen
                        : styles.liveDotYellow
                    : styles.liveDotNeutral,
                ]}
              />
              <Text
                style={[
                  styles.liveBadgeText,
                  activeBusLocation
                    ? isSharingGps
                      ? styles.liveBadgeTextGreen
                      : activeBusLocation.isLive
                        ? styles.liveBadgeTextGreen
                        : styles.liveBadgeTextYellow
                    : styles.liveBadgeTextNeutral,
                ]}
              >
                {activeBusLocation
                  ? isSharingGps
                    ? "Sharing"
                    : activeBusLocation.isLive
                      ? "Live"
                      : "Estimated"
                  : "Idle"}
              </Text>
            </View>
          </View>

          <Text style={styles.headerSubtitle}>
            {activeBus
              ? `Tracking bus ${activeBus.busNumber}${scheduleStartTime ? ` • Starts ${to12h(scheduleStartTime)}` : ""}`
              : "Select a bus from the panel to view route and location."}
          </Text>

          {activeBus ? (
            <View style={styles.activeBusBadge}>
              <Text style={styles.activeBusText}>Route focus: {activeBus.busNumber}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {toastMsg ? (
        <View
          pointerEvents="none"
          style={[styles.toast, { top: insets.top + 102 }]}
        >
          <Text style={styles.toastText}>{toastMsg}</Text>
        </View>
      ) : null}

      {isSharingGps && (
        <View style={[styles.gpsFooter, { bottom: insets.bottom + 12 }]}>
          <View style={styles.gpsPulse} />
          <Text style={styles.gpsFooterText}>
            Sharing location - Bus {sharingForBusId}
          </Text>
          <TouchableOpacity
            style={styles.gpsStopButton}
            onPress={() => stopSharingGps("Tracking stopped")}
          >
            <Text style={styles.gpsStopText}>Stop</Text>
          </TouchableOpacity>
        </View>
      )}

      <BottomSheet
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        index={1}
        backgroundStyle={styles.bottomSheetBg}
        handleIndicatorStyle={styles.bottomSheetHandle}
        enablePanDownToClose={false}
      >
        <BottomSheetView style={styles.bottomSheetHeader}>
          <View style={styles.bottomSheetHeaderRow}>
            <Text style={styles.bottomSheetTitle}>
              {loadingBuses
                ? "Loading Buses..."
                : `Buses Available (${buses.length})`}
            </Text>
            {activeBus && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => handleTrackBus(activeBus.id)}
              >
                <Text style={styles.clearButtonText}>Clear Map</Text>
              </TouchableOpacity>
            )}
          </View>
          {!activeBus && !loadingBuses && buses.length > 0 && (
            <Text style={styles.bottomSheetHint}>
              Tap Track to view the route, or Share to volunteer live location
            </Text>
          )}
          {!loadingBuses && buses.length === 0 && (
            <Text style={styles.bottomSheetHint}>
              No buses available at the moment
            </Text>
          )}
        </BottomSheetView>

        <View style={styles.divider} />

        {loadingBuses ? (
          <BottomSheetView style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Fetching buses...</Text>
          </BottomSheetView>
        ) : buses.length === 0 ? (
          <BottomSheetView style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No buses available</Text>
          </BottomSheetView>
        ) : (
          <BottomSheetFlatList
            data={buses}
            keyExtractor={(item: IBus) => item.id.toString()}
            renderItem={renderBusCard}
            contentContainerStyle={styles.busList}
            showsVerticalScrollIndicator={false}
          />
        )}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerOverlay: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 20,
  },
  headerCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.outline,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.onSurface,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.onSurfaceMuted,
    marginTop: 5,
  },
  activeBusBadge: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: "#A2C3F8",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 8,
    alignSelf: "flex-start",
  },
  activeBusText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primary,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  liveBadgeGreen: {
    backgroundColor: COLORS.successSoft,
    borderColor: "#A8DBBC",
  },
  liveBadgeYellow: {
    backgroundColor: COLORS.warningSoft,
    borderColor: "#E4C580",
  },
  liveBadgeNeutral: {
    backgroundColor: COLORS.surfaceLow,
    borderColor: COLORS.outline,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveDotGreen: {
    backgroundColor: COLORS.success,
  },
  liveDotYellow: {
    backgroundColor: COLORS.warning,
  },
  liveDotNeutral: {
    backgroundColor: COLORS.onSurfaceMuted,
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  liveBadgeTextGreen: {
    color: COLORS.success,
  },
  liveBadgeTextYellow: {
    color: COLORS.warning,
  },
  liveBadgeTextNeutral: {
    color: COLORS.onSurfaceMuted,
  },
  toast: {
    position: "absolute",
    alignSelf: "center",
    zIndex: 30,
    backgroundColor: COLORS.dark,
    borderWidth: 1,
    borderColor: "#3C4456",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    maxWidth: "80%",
  },
  toastText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  bottomSheetBg: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.outline,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  bottomSheetHandle: {
    backgroundColor: COLORS.outline,
    width: 44,
    height: 4,
  },
  bottomSheetHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 11,
  },
  bottomSheetHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  bottomSheetTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.onSurface,
  },
  bottomSheetHint: {
    fontSize: 13,
    color: COLORS.onSurfaceMuted,
    marginTop: 4,
  },
  clearButton: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    backgroundColor: COLORS.dangerSoft,
    borderWidth: 1,
    borderColor: "#EAB5B1",
    borderRadius: 8,
  },
  clearButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.danger,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.outline,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  loadingContainer: {
    alignItems: "center",
    paddingTop: 40,
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: COLORS.onSurfaceMuted,
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 40,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.onSurfaceMuted,
    fontWeight: "600",
  },
  busList: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 42,
    gap: 9,
  },
  busCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.outline,
  },
  busCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primarySoft,
  },
  busCardInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  busNumberContainer: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.surfaceLow,
    borderWidth: 1,
    borderColor: COLORS.outline,
    borderRadius: 8,
  },
  busNumber: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.onSurface,
  },
  busNumberActive: {
    color: COLORS.primary,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusLive: {
    backgroundColor: COLORS.successSoft,
    borderColor: "#A8DBBC",
  },
  statusEstimated: {
    backgroundColor: COLORS.warningSoft,
    borderColor: "#E4C580",
  },
  statusIdle: {
    backgroundColor: COLORS.surfaceLow,
    borderColor: COLORS.outline,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dotGreen: {
    backgroundColor: COLORS.success,
  },
  dotYellow: {
    backgroundColor: COLORS.warning,
  },
  dotGray: {
    backgroundColor: COLORS.onSurfaceMuted,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
  },
  statusLiveText: {
    color: COLORS.success,
  },
  statusEstimatedText: {
    color: COLORS.warning,
  },
  statusIdleText: {
    color: COLORS.onSurfaceMuted,
  },
  trackButton: {
    backgroundColor: COLORS.primary,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 70,
    alignItems: "center",
  },
  trackButtonActive: {
    backgroundColor: COLORS.dangerSoft,
    borderColor: "#EAB5B1",
  },
  trackButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  trackButtonTextActive: {
    color: COLORS.danger,
  },
  busCardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  shareButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 96,
    alignItems: "center",
  },
  shareButtonStart: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  shareButtonStop: {
    backgroundColor: COLORS.dangerSoft,
    borderColor: "#EAB5B1",
  },
  shareButtonDisabled: {
    opacity: 0.55,
  },
  shareButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  shareButtonTextStop: {
    color: COLORS.danger,
  },
  gpsFooter: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.dark,
    borderWidth: 1,
    borderColor: "#3C4456",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    zIndex: 25,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  gpsPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
  },
  gpsFooterText: {
    flex: 1,
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  gpsStopButton: {
    backgroundColor: COLORS.dangerSoft,
    borderWidth: 1,
    borderColor: "#EAB5B1",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  gpsStopText: {
    color: COLORS.danger,
    fontSize: 11,
    fontWeight: "700",
  },
  busMarkerWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.09,
    shadowRadius: 4,
    elevation: 2,
  },
  markerPopupText: {
    fontSize: 12,
    color: COLORS.onSurface,
  },
});
