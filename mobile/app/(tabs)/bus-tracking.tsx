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
import { useFocusEffect } from "@react-navigation/native";
import { busAPI, locationAPI, trackingAPI } from "@/lib/api";
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
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);

  const [isSharingGps, setIsSharingGps] = useState(false);
  const [sharingForBusId, setSharingForBusId] = useState<number | null>(null);
  const [userGpsLocation, setUserGpsLocation] = useState<{ lat: number; lng: number } | null>(null);
  const isSharingRef = useRef(false);
  const sharingBusIdRef = useRef<number | null>(null);
  const activeRouteIdRef = useRef<number | null>(null);
  const gpsSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const passiveLocationSubscriptionRef =
    useRef<Location.LocationSubscription | null>(null);
  const handledRequestIdRef = useRef<number | null>(null);

  const mapRef = useRef<MapRefHandle | null>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const socketRef = useRef<Socket | null>(null);
  const requestToStartSharing = useBusTrackingStore(
    (state) => state.requestToStartSharing,
  );
  const setRequestToStartSharing = useBusTrackingStore(
    (state) => state.setRequestToStartSharing,
  );
  const setPendingRequests = useBusTrackingStore((state) => state.setPendingRequests);
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

  const leaveTrackingRoom = useCallback((busId?: number | null, routeId?: number | null) => {
    const socket = socketRef.current;
    if (!socket || !busId) return;

    socket.emit("leave_bus_route", {
      busId,
      routeId: routeId ?? undefined,
    });
  }, []);

  const acceptTracking = useCallback(
    async (busId: number) => {
      const socket = socketRef.current;
      if (!socket) return;

      socket.emit("accept_tracking", { busId });
      isSharingRef.current = true;
      sharingBusIdRef.current = busId;
      setIsSharingGps(true);
      setSharingForBusId(busId);
      setSharingState(true, busId);

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setHasLocationPermission(false);
          socket.emit("stop_tracking", { busId });
          isSharingRef.current = false;
          sharingBusIdRef.current = null;
          setIsSharingGps(false);
          setSharingForBusId(null);
          setSharingState(false, null);
          showToast("Location permission required");
          return;
        }

        setHasLocationPermission(true);

        const initialPosition = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest,
        });
        const initialLat = initialPosition.coords.latitude;
        const initialLng = initialPosition.coords.longitude;

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
      } catch {
        socket.emit("stop_tracking", { busId });
        isSharingRef.current = false;
        sharingBusIdRef.current = null;
        setIsSharingGps(false);
        setSharingForBusId(null);
        setSharingState(false, null);
        setUserGpsLocation(null);
        showToast("Failed to start GPS tracking");
      }
    },
    [setSharingState, showToast],
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

  useFocusEffect(
    useCallback(() => {
      let active = true;

      trackingAPI
        .getPendingRequests()
        .then((res) => {
          if (!active) return;
          setPendingRequests(res.data?.data || []);
        })
        .catch(() => {});

      return () => {
        active = false;
      };
    }, [setPendingRequests]),
  );

  useEffect(() => {
    if (!requestToStartSharing) return;
    if (handledRequestIdRef.current === requestToStartSharing.id) return;

    handledRequestIdRef.current = requestToStartSharing.id;

    if (
      isSharingRef.current &&
      sharingBusIdRef.current === requestToStartSharing.busId
    ) {
      setRequestToStartSharing(null);
      return;
    }

    acceptTracking(requestToStartSharing.busId)
      .catch(() => {})
      .finally(() => {
        setRequestToStartSharing(null);
      });
  }, [acceptTracking, requestToStartSharing, setRequestToStartSharing]);

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
    let mounted = true;

    (async () => {
      try {
        const socket = await getSocket();
        if (!mounted) return;
        socketRef.current = socket;

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
      socketRef.current?.off("bus_location_update");
      socketRef.current?.off("tracking_started");
      socketRef.current?.off("tracking_rejected");
      socketRef.current?.off("tracking_expired");
      socketRef.current?.off("tracking_off_route");
      socketRef.current?.off("bus_tracking_ended");
      gpsSubscriptionRef.current?.remove();
      gpsSubscriptionRef.current = null;
    };
  }, [
    acceptTracking,
    activeBusId,
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
        if (mode === "not_started") {
          showToast(`Bus starts at ${estimate?.startTime}`);
        } else if (mode === "ended") {
          showToast(`Route ended for today`);
        } else if (data.isLive) {
          showToast("Live tracking active");
        } else if (mode === "estimated") {
          showToast("Estimated location shown");
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

          mapRef.current?.animateToRegion(
            {
              latitude: estimateLat,
              longitude: estimateLng,
              latitudeDelta: 0.06,
              longitudeDelta: 0.06,
            },
            900,
          );
        }

        bottomSheetRef.current?.snapToIndex(0);
      } catch (err: any) {
        const msg = err?.response?.data?.message ?? "Failed to start tracking.";
        Alert.alert("Tracking Error", msg);
      }

      setTrackingBusId(null);
    },
    [activeBusId, joinTrackingRoom, leaveTrackingRoom, showToast],
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
          <TouchableOpacity
            style={[styles.trackButton, isActive && styles.trackButtonActive]}
            onPress={() => handleTrackBus(item.id)}
            disabled={!isActive && trackingBusId !== null}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={isActive ? COLORS.danger : "#FFFFFF"} />
            ) : (
              <Text style={[styles.trackButtonText, isActive && styles.trackButtonTextActive]}>
                {isActive ? "Stop" : "Track"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      );
    },
    [activeBusId, busLocations, trackingBusId, handleTrackBus],
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
              Tap Track to see bus on map
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
    minWidth: 72,
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
