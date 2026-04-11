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
import MapView, { Marker, Polyline } from "react-native-maps";
import * as Location from "expo-location";
import BottomSheet, {
  BottomSheetFlatList,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { busAPI, locationAPI } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type { IBus, IBusLiveLocation, IRoutePoint } from "@/interfaces";
import type { Socket } from "socket.io-client";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const DEFAULT_REGION = {
  latitude: 22.9,
  longitude: 89.5,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
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
    `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`,
  );
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

  // If after route end, return last point
  const lastOffset = routePoints[routePoints.length - 1].minuteOffset;
  if (elapsed > lastOffset) {
    const last = routePoints[routePoints.length - 1];
    return { lat: last.lat, lng: last.lng };
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

/**
 * Get color based on offset progress (0% = green, 50% = orange, 100% = red)
 */
function getOffsetColor(offsetPercent: number): string {
  // Clamp between 0 and 1
  const p = Math.max(0, Math.min(1, offsetPercent));
  
  if (p < 0.5) {
    // Green to Yellow: 0% -> green (#22C55E), 50% -> orange (#F59E0B)
    const ratio = p * 2; // 0 to 1
    return interpolateColor("#22C55E", "#F59E0B", ratio);
  } else {
    // Yellow to Red: 50% -> orange (#F59E0B), 100% -> red (#EF4444)
    const ratio = (p - 0.5) * 2; // 0 to 1
    return interpolateColor("#F59E0B", "#EF4444", ratio);
  }
}

function interpolateColor(color1: string, color2: string, t: number): string {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  const r = Math.round(c1.r + (c2.r - c1.r) * t);
  const g = Math.round(c1.g + (c2.g - c1.g) * t);
  const b = Math.round(c1.b + (c2.b - c1.b) * t);
  return `rgb(${r},${g},${b})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return {
    r: parseInt(result![1], 16),
    g: parseInt(result![2], 16),
    b: parseInt(result![3], 16),
  };
}

function StopMarker({
  type,
  time,
  offsetColor,
}: {
  type: "start" | "end" | "mid";
  time: string;
  offsetColor?: string;
}) {
  const bgColor = offsetColor || (type === "start" ? "#22C55E" : type === "end" ? "#EF4444" : "#3B82F6");
  const label =
    type === "start" ? "S" : type === "end" ? "E" : time;
  
  // Larger sizes for better time text visibility
  const outerSize = type === "mid" ? 42 : 36;
  const innerSize = type === "mid" ? 26 : 20;
  const fontSize = type === "mid" ? 8 : 11;

  return (
    <View
      style={{
        width: outerSize,
        height: outerSize,
        borderRadius: outerSize / 2,
        backgroundColor: "rgba(255,255,255,0.95)",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
      }}
    >
      <View
        style={{
          width: innerSize,
          height: innerSize,
          borderRadius: innerSize / 2,
          backgroundColor: bgColor,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text 
          numberOfLines={1}
          style={{ 
            color: "#fff", 
            fontSize, 
            fontWeight: "700",
            textAlign: "center",
            paddingHorizontal: 2,
          }}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

function BusMarkerDot({
  isLive,
  confidence,
}: {
  isLive: boolean;
  confidence: number;
}) {
  const color = isLive ? "#22C55E" : confidence > 0.7 ? "#EAB308" : "#F97316";
  return (
    <View style={styles.busMarkerWrap}>
      <View style={[styles.busMarkerCore, { backgroundColor: color }]} />
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
  const [scheduleStartTime, setScheduleStartTime] = useState<string | null>(
    null,
  );
  const [loadingBuses, setLoadingBuses] = useState(true);
  const [trackingBusId, setTrackingBusId] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [isSharingGps, setIsSharingGps] = useState(false);
  const [sharingForBusId, setSharingForBusId] = useState<number | null>(null);
  const [userGpsLocation, setUserGpsLocation] = useState<{ lat: number; lng: number } | null>(null);
  const isSharingRef = useRef(false);
  const sharingBusIdRef = useRef<number | null>(null);
  const gpsSubscriptionRef = useRef<Location.LocationSubscription | null>(null);

  const mapRef = useRef<MapView>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const socketRef = useRef<Socket | null>(null);

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
      setUserGpsLocation(null);
      if (busId && socketRef.current) {
        socketRef.current.emit("stop_tracking", { busId });
      }
      if (reason) showToast(reason);
    },
    [showToast],
  );

  const acceptTracking = useCallback(
    async (busId: number) => {
      const socket = socketRef.current;
      if (!socket) return;
      socket.emit("accept_tracking", { busId });

      isSharingRef.current = true;
      sharingBusIdRef.current = busId;
      setIsSharingGps(true);
      setSharingForBusId(busId);

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          showToast("Location permission required");
          return;
        }

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
        showToast("Failed to start GPS tracking");
      }
    },
    [showToast],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
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
    if (activeBusId === null || routePoints.length === 0 || !scheduleStartTime || isSharingGps) {
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
  }, [activeBusId, routePoints, scheduleStartTime, isSharingGps]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const socket = await getSocket();
        if (!mounted) return;
        socketRef.current = socket;

        socket.on("bus_location_update", (data: any) => {
          if (!mounted) return;
          const lat: number = data.estimate?.lat ?? data.lat;
          const lng: number = data.estimate?.lng ?? data.lng;
          const confidence: number = data.estimate?.confidence ?? 1;

          setBusLocations((prev) => ({
            ...prev,
            [data.busId]: {
              busId: data.busId,
              lat,
              lng,
              isLive: true,
              confidence,
            },
          }));
        });

        socket.on("bus_tracking_request", (data: any) => {
          if (!mounted) return;
          if (isSharingRef.current && sharingBusIdRef.current === data.busId)
            return;
          if (isSharingRef.current) return;

          Alert.alert(
            "Bus Tracking Request",
            "A tracking request was received for a bus near your location. Are you currently riding it?",
            [
              { text: "No", style: "cancel" },
              {
                text: "Yes, I'm on it",
                onPress: () => acceptTracking(data.busId),
              },
            ],
          );
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
      } catch {}
    })();

    return () => {
      mounted = false;
      socketRef.current?.off("bus_location_update");
      socketRef.current?.off("bus_tracking_request");
      socketRef.current?.off("tracking_started");
      socketRef.current?.off("tracking_rejected");
      socketRef.current?.off("tracking_expired");
      socketRef.current?.off("tracking_off_route");
      gpsSubscriptionRef.current?.remove();
      gpsSubscriptionRef.current = null;
    };
  }, [acceptTracking, showToast, stopSharingGps]);

  const handleTrackBus = useCallback(
    async (busId: number) => {
      if (activeBusId === busId) {
        setActiveBusId(null);
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
        const res = await busAPI.requestTracking(busId);
        const data = res.data;

        setActiveBusId(busId);
        setRoutePoints(data.points ?? []);
        setScheduleStartTime(data.startTime ?? null);

        // Debug logging
        console.log("🗺️ Bus tracked:", busId);
        console.log("Route points received:", data.points?.length || 0);
        console.log("Start time:", data.startTime);
        if (data.points && data.points.length > 0) {
          console.log("First point:", data.points[0]);
          console.log("Route point offsets:", data.points.map((p: any) => p.minuteOffset));
        }

        const mode = data.estimate?.mode;
        if (mode === "not_started") {
          showToast(`Bus starts at ${data.estimate.startTime}`);
        } else if (mode === "ended") {
          showToast(`Route ended for today`);
        } else if (data.isLive) {
          showToast("Live tracking active");
        } else if (mode === "estimated") {
          showToast("Estimated location shown");
        }

        if (data.estimate?.lat != null && data.estimate?.lng != null) {
          setBusLocations((prev) => ({
            ...prev,
            [busId]: {
              busId,
              lat: data.estimate.lat,
              lng: data.estimate.lng,
              isLive: data.isLive ?? false,
              confidence: data.estimate.confidence ?? 0.5,
            },
          }));

          mapRef.current?.animateToRegion(
            {
              latitude: data.estimate.lat,
              longitude: data.estimate.lng,
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
    [activeBusId, showToast],
  );

  const polylineCoords = useMemo(
    () => routePoints.map((p) => ({ latitude: p.lat, longitude: p.lng })),
    [routePoints],
  );

  const activeBusLocation = activeBusId ? busLocations[activeBusId] : null;
  const activeBus = buses.find((b) => b.id === activeBusId);

  const renderBusCard = useCallback(
    ({ item }: { item: IBus }) => {
      const isActive = activeBusId === item.id;
      const loc = busLocations[item.id];
      const isLoading = trackingBusId === item.id;

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
            {loc && (
              <View
                style={[
                  styles.statusBadge,
                  loc.isLive ? styles.statusLive : styles.statusEstimated,
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    loc.isLive ? styles.dotGreen : styles.dotYellow,
                  ]}
                />
                <Text
                  style={[
                    styles.statusText,
                    loc.isLive
                      ? styles.statusLiveText
                      : styles.statusEstimatedText,
                  ]}
                >
                  {loc.isLive ? "Live" : "Est."}
                </Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={[styles.trackButton, isActive && styles.trackButtonActive]}
            onPress={() => handleTrackBus(item.id)}
            disabled={!isActive && trackingBusId !== null}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.trackButtonText}>
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
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={DEFAULT_REGION}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {polylineCoords.length > 1 && (
          <Polyline
            coordinates={polylineCoords}
            strokeColor="#3B82F6"
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {routePoints.map((pt, idx) => {
          const type =
            idx === 0
              ? "start"
              : idx === routePoints.length - 1
                ? "end"
                : "mid";
          
          // Calculate offset color based on progression through route
          const maxOffset = Math.max(...routePoints.map(p => p.minuteOffset), 1);
          const offsetPercent = pt.minuteOffset / maxOffset;
          const offsetColor = getOffsetColor(offsetPercent);
          
          // Calculate time at this point: startTime + minuteOffset
          const time = pointTime(scheduleStartTime, pt.minuteOffset);
          
          return (
            <Marker
              key={`stop-${pt.sequence}`}
              coordinate={{ latitude: pt.lat, longitude: pt.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={true}
            >
              <StopMarker type={type} time={time} offsetColor={offsetColor} />
            </Marker>
          );
        })}

        {Object.values(busLocations).map((loc) => {
          // If sharing GPS, show user's location; otherwise show estimated/calculated position
          const displayLoc = isSharingGps && userGpsLocation ? userGpsLocation : loc;
          
          return (
            <Marker
              key={`bus-${loc.busId}`}
              coordinate={{ latitude: displayLoc.lat, longitude: displayLoc.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              title={`Bus ${buses.find((b) => b.id === loc.busId)?.busNumber ?? loc.busId}`}
              description={
                isSharingGps
                  ? "Your location (sharing)"
                  : loc.isLive
                    ? "Live location"
                    : `Estimated - ${(loc.confidence * 100).toFixed(0)}% confidence`
              }
            >
              <BusMarkerDot isLive={isSharingGps ? false : loc.isLive} confidence={isSharingGps ? 1 : loc.confidence} />
            </Marker>
          );
        })}
      </MapView>

      <View
        pointerEvents="none"
        style={[styles.headerOverlay, { top: insets.top + 12 }]}
      >
        <View style={styles.headerCard}>
          <Text style={styles.headerTitle}>Live Bus Tracking</Text>
          {activeBus && (
            <View style={styles.activeBusBadge}>
              <Text style={styles.activeBusText}>
                Tracking: {activeBus.busNumber}
              </Text>
            </View>
          )}
          {activeBusLocation && (
            <View
              style={[
                styles.liveBadge,
                isSharingGps
                  ? styles.liveBadgeGreen
                  : activeBusLocation.isLive
                    ? styles.liveBadgeGreen
                    : styles.liveBadgeYellow,
              ]}
            >
              <View
                style={[
                  styles.liveDot,
                  isSharingGps
                    ? styles.liveDotGreen
                    : activeBusLocation.isLive
                      ? styles.liveDotGreen
                      : styles.liveDotYellow,
                ]}
              />
              <Text
                style={[
                  styles.liveBadgeText,
                  isSharingGps
                    ? styles.liveBadgeTextGreen
                    : activeBusLocation.isLive
                      ? styles.liveBadgeTextGreen
                      : styles.liveBadgeTextYellow,
                ]}
              >
                {isSharingGps ? "Sharing Location" : activeBusLocation.isLive ? "Live" : "Estimated"}
              </Text>
            </View>
          )}
        </View>
      </View>

      {toastMsg ? (
        <View
          pointerEvents="none"
          style={[styles.toast, { top: insets.top + 80 }]}
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
            <ActivityIndicator size="large" color="#3B82F6" />
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
    backgroundColor: "#F1F5F9",
  },
  headerOverlay: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 20,
  },
  headerCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  activeBusBadge: {
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activeBusText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#1D4ED8",
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  liveBadgeGreen: {
    backgroundColor: "#DCFCE7",
  },
  liveBadgeYellow: {
    backgroundColor: "#FEF9C3",
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveDotGreen: {
    backgroundColor: "#16A34A",
  },
  liveDotYellow: {
    backgroundColor: "#CA8A04",
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  liveBadgeTextGreen: {
    color: "#15803D",
  },
  liveBadgeTextYellow: {
    color: "#A16207",
  },
  toast: {
    position: "absolute",
    alignSelf: "center",
    zIndex: 30,
    backgroundColor: "rgba(15,23,42,0.9)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    maxWidth: "80%",
  },
  toastText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
  },
  bottomSheetBg: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  bottomSheetHandle: {
    backgroundColor: "#CBD5E1",
    width: 40,
    height: 4,
  },
  bottomSheetHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  bottomSheetHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  bottomSheetHint: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 4,
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
  },
  clearButtonText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#DC2626",
  },
  divider: {
    height: 1,
    backgroundColor: "#E2E8F0",
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
    color: "#94A3B8",
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 40,
  },
  emptyText: {
    fontSize: 14,
    color: "#94A3B8",
    fontWeight: "500",
  },
  busList: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 10,
  },
  busCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  busCardActive: {
    borderColor: "#3B82F6",
    backgroundColor: "#EFF6FF",
  },
  busCardInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  busNumberContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#E2E8F0",
    borderRadius: 8,
  },
  busNumber: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
  },
  busNumberActive: {
    color: "#1D4ED8",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusLive: {
    backgroundColor: "#DCFCE7",
  },
  statusEstimated: {
    backgroundColor: "#FEF9C3",
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dotGreen: {
    backgroundColor: "#16A34A",
  },
  dotYellow: {
    backgroundColor: "#CA8A04",
  },
  statusText: {
    fontSize: 10,
    fontWeight: "600",
  },
  statusLiveText: {
    color: "#15803D",
  },
  statusEstimatedText: {
    color: "#A16207",
  },
  trackButton: {
    backgroundColor: "#3B82F6",
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 8,
    minWidth: 70,
    alignItems: "center",
  },
  trackButtonActive: {
    backgroundColor: "#EF4444",
  },
  trackButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  gpsFooter: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15,23,42,0.95)",
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
    backgroundColor: "#22C55E",
  },
  gpsFooterText: {
    flex: 1,
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
  },
  gpsStopButton: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  gpsStopText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  busMarkerWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  busMarkerCore: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
});
