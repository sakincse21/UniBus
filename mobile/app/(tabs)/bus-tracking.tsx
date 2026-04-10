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
import type {
  IBus,
  IBusLiveLocation,
  IRoutePoint,
} from "@/interfaces";
import type { Socket } from "socket.io-client";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_REGION = {
  latitude: 22.9,
  longitude: 89.5,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Stop Marker (rich, matches web UI) ──────────────────────────────────────

function StopMarker({
  type,
  sequence,
  time,
}: {
  type: "start" | "end" | "mid";
  sequence: number;
  time?: string;
}) {
  const bgColor =
    type === "start" ? "#22C55E" : type === "end" ? "#EF4444" : "#3B82F6";
  const label = type === "start" ? "S" : type === "end" ? "E" : String(sequence);
  const size = type === "mid" ? 22 : 26;

  return (
    <View style={{ alignItems: "center" }}>
      {time ? (
        <View
          style={{
            backgroundColor: "rgba(255,255,255,0.94)",
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 6,
            marginBottom: 3,
            shadowColor: "#000",
            shadowOpacity: 0.18,
            shadowRadius: 4,
            elevation: 4,
          }}
        >
          <Text style={{ fontSize: 9, fontWeight: "700", color: "#0f172a" }}>
            {time}
          </Text>
        </View>
      ) : null}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bgColor,
          borderWidth: 2.5,
          borderColor: "#fff",
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 5,
          elevation: 5,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>
          {label}
        </Text>
      </View>
    </View>
  );
}

// ─── Bus Marker ───────────────────────────────────────────────────────────────

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

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function BusTrackingTab() {
  const insets = useSafeAreaInsets();

  const [buses, setBuses] = useState<IBus[]>([]);
  const [activeBusId, setActiveBusId] = useState<number | null>(null);
  const [busLocations, setBusLocations] = useState<
    Record<number, IBusLiveLocation>
  >({});
  const [routePoints, setRoutePoints] = useState<IRoutePoint[]>([]);
  const [scheduleStartTime, setScheduleStartTime] = useState<string | null>(
    null
  );
  const [loadingBuses, setLoadingBuses] = useState(true);
  const [trackingBusId, setTrackingBusId] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // ── Live GPS sharing state (when user is the tracker) ──────────────────────
  const [isSharingGps, setIsSharingGps] = useState(false);
  const [sharingForBusId, setSharingForBusId] = useState<number | null>(null);
  const isSharingRef = useRef(false);           // stable ref for socket callbacks
  const sharingBusIdRef = useRef<number | null>(null);
  const gpsSubscriptionRef = useRef<Location.LocationSubscription | null>(null);

  const mapRef = useRef<MapView>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const socketRef = useRef<Socket | null>(null);

  const snapPoints = useMemo(() => ["18%", "52%", "90%"], []);

  // ── Toast helper ────────────────────────────────────────────────────────────
  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  }, []);

  // ── Stop sharing GPS (tracker role) ─────────────────────────────────────────
  const stopSharingGps = useCallback(
    async (reason?: string) => {
      gpsSubscriptionRef.current?.remove();
      gpsSubscriptionRef.current = null;
      const busId = sharingBusIdRef.current;
      isSharingRef.current = false;
      sharingBusIdRef.current = null;
      setIsSharingGps(false);
      setSharingForBusId(null);
      if (busId && socketRef.current) {
        socketRef.current.emit("stop_tracking", { busId });
      }
      if (reason) showToast(reason);
    },
    [showToast]
  );

  // ── Accept tracking request & start GPS watch ────────────────────────────────
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
          showToast("Location permission required to share bus position");
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
            socketRef.current?.emit("gps_update", {
              busId,
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            });
          }
        );

        gpsSubscriptionRef.current = sub;
        showToast("Now sharing your location as bus tracker 🚌");
      } catch {
        showToast("Failed to start GPS tracking");
      }
    },
    [showToast]
  );

  // ── Location + buses on mount ────────────────────────────────────────────────
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
            // Center map on user's GPS location
            mapRef.current?.animateToRegion(
              {
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
                latitudeDelta: 0.08,
                longitudeDelta: 0.08,
              },
              1200
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
          setBuses(res.data?.data ?? []);
        } catch {
          showToast("Failed to load buses.");
        }
        setLoadingBuses(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Socket: live updates + tracking notifications ───────────────────────────
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

          mapRef.current?.animateToRegion(
            {
              latitude: lat,
              longitude: lng,
              latitudeDelta: 0.04,
              longitudeDelta: 0.04,
            },
            800
          );
        });

        // ── Tracking-request notification (are you on this bus?) ─────────────
        socket.on("bus_tracking_request", (data: any) => {
          if (!mounted) return;
          // Already sharing GPS for this bus — keep sending, skip alert
          if (isSharingRef.current && sharingBusIdRef.current === data.busId) return;
          // Already busy tracking another bus — don't interrupt
          if (isSharingRef.current) return;

          Alert.alert(
            "Are you on the bus? 🚌",
            "A tracking request was received for a bus near your location. Are you currently riding it?",
            [
              { text: "No", style: "cancel" },
              {
                text: "Yes, I'm on it",
                onPress: () => acceptTracking(data.busId),
              },
            ]
          );
        });

        // Tracking session confirmed
        socket.on("tracking_started", (_data: any) => {
          if (!mounted) return;
          showToast("Live tracking confirmed ✅");
        });

        // Rejected (another user is already tracking)
        socket.on("tracking_rejected", (_data: any) => {
          if (!mounted) return;
          stopSharingGps("Another user is already tracking this bus");
        });

        // Session expired (schedule ended)
        socket.on("tracking_expired", (data: any) => {
          if (!mounted) return;
          if (isSharingRef.current && sharingBusIdRef.current === data.busId) {
            stopSharingGps("Tracking session expired (schedule ended)");
          }
        });

        // Off-route: server detected user is >250m from the route
        socket.on("tracking_off_route", (data: any) => {
          if (!mounted) return;
          if (isSharingRef.current && sharingBusIdRef.current === data.busId) {
            stopSharingGps(
              `Off-route detected (${data.dist}m away). Tracking stopped.`
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
      // Clean up GPS subscription
      gpsSubscriptionRef.current?.remove();
      gpsSubscriptionRef.current = null;
    };
  }, [acceptTracking, showToast, stopSharingGps]);

  // ── Handle track / stop ─────────────────────────────────────────────────────
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
        return;
      }

      setTrackingBusId(busId);

      try {
        const res = await busAPI.requestTracking(busId);
        const data = res.data;

        setActiveBusId(busId);
        setRoutePoints(data.points ?? []);
        setScheduleStartTime(data.startTime ?? null);

        const mode = data.estimate?.mode;
        if (mode === "not_started") {
          showToast(
            `Bus hasn't started yet · ${data.estimate.startTime} – ${data.estimate.endTime}`
          );
        } else if (mode === "ended") {
          showToast(
            `Route ended for today · ${data.estimate.startTime} – ${data.estimate.endTime}`
          );
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
            900
          );
        }

        bottomSheetRef.current?.snapToIndex(0);
      } catch (err: any) {
        const msg =
          err?.response?.data?.message ?? "Failed to start tracking.";
        Alert.alert("Tracking Error", msg);
      }

      setTrackingBusId(null);
    },
    [activeBusId, showToast]
  );

  // ── Derived ──────────────────────────────────────────────────────────────────
  const polylineCoords = useMemo(
    () => routePoints.map((p) => ({ latitude: p.lat, longitude: p.lng })),
    [routePoints]
  );

  const activeBusLocation = activeBusId ? busLocations[activeBusId] : null;
  const activeBus = buses.find((b) => b.id === activeBusId);

  // ── Bus card renderer ────────────────────────────────────────────────────────
  const renderBusCard = useCallback(
    ({ item }: { item: IBus }) => {
      const isActive = activeBusId === item.id;
      const loc = busLocations[item.id];
      const isLoading = trackingBusId === item.id;

      return (
        <View style={[styles.busCard, isActive && styles.busCardActive]}>
          <View style={styles.busCardLeft}>
            <View
              style={[
                styles.busNumberPill,
                isActive && styles.busNumberPillActive,
              ]}
            >
              <Text
                style={[
                  styles.busNumberText,
                  isActive && styles.busNumberTextActive,
                ]}
              >
                {item.busNumber}
              </Text>
            </View>

            {loc ? (
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
                    styles.statusLabel,
                    loc.isLive ? styles.labelGreen : styles.labelYellow,
                  ]}
                >
                  {loc.isLive ? "Live" : "Est."}
                </Text>
              </View>
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.actionBtn, isActive && styles.actionBtnStop]}
            onPress={() => handleTrackBus(item.id)}
            disabled={!isActive && trackingBusId !== null}
            activeOpacity={0.75}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.actionBtnText}>
                {isActive ? "Stop" : "Track"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      );
    },
    [activeBusId, busLocations, trackingBusId, handleTrackBus]
  );

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      {/* ── Full-screen Map ── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={DEFAULT_REGION}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {/* Route polyline */}
        {polylineCoords.length > 1 && (
          <Polyline
            coordinates={polylineCoords}
            strokeColor="#3B82F6"
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {/* Route stop markers */}
        {normalizeRoutePoints(routePoints).map((pt, idx) => {
          const type =
            idx === 0
              ? "start"
              : idx === routePoints.length - 1
              ? "end"
              : "mid";
          const time = scheduleStartTime
            ? pointTime(scheduleStartTime, pt.minuteOffset)
            : undefined;
          return (
            <Marker
              key={`stop-${pt.sequence}`}
              coordinate={{ latitude: pt.lat, longitude: pt.lng }}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={false}
            >
              <StopMarker type={type} sequence={pt.sequence} time={time} />
            </Marker>
          );
        })}

        {/* Bus location markers */}
        {Object.values(busLocations).map((loc) => (
          <Marker
            key={`bus-${loc.busId}`}
            coordinate={{ latitude: loc.lat, longitude: loc.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            title={`Bus ${buses.find((b) => b.id === loc.busId)?.busNumber ?? loc.busId}`}
            description={
              loc.isLive
                ? "Live location"
                : `Estimated · ${(loc.confidence * 100).toFixed(0)}% confidence`
            }
          >
            <BusMarkerDot isLive={loc.isLive} confidence={loc.confidence} />
          </Marker>
        ))}
      </MapView>

      {/* ── Floating header ── */}
      <View
        pointerEvents="none"
        style={[styles.headerOverlay, { top: insets.top + 8 }]}
      >
        <View style={styles.headerCard}>
          <View>
            <Text style={styles.headerTitle}>Live Bus Tracking</Text>
            {activeBus && (
              <Text style={styles.headerSub}>Tracking {activeBus.busNumber}</Text>
            )}
          </View>

          {activeBusLocation && (
            <View
              style={[
                styles.livePill,
                activeBusLocation.isLive
                  ? styles.livePillGreen
                  : styles.livePillYellow,
              ]}
            >
              <View
                style={[
                  styles.liveDot,
                  activeBusLocation.isLive
                    ? styles.liveDotGreen
                    : styles.liveDotYellow,
                ]}
              />
              <Text
                style={[
                  styles.livePillText,
                  activeBusLocation.isLive
                    ? styles.livePillTextGreen
                    : styles.livePillTextYellow,
                ]}
              >
                {activeBusLocation.isLive ? "Live" : "Estimated"}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Toast notification ── */}
      {toastMsg ? (
        <View
          pointerEvents="none"
          style={[styles.toast, { top: insets.top + 80 }]}
        >
          <Text style={styles.toastText}>{toastMsg}</Text>
        </View>
      ) : null}

      {/* ── GPS Sharing footer (when this user is the bus tracker) ── */}
      {isSharingGps && (
        <View style={[styles.gpsFooter, { bottom: insets.bottom + 8 }]}>
          <View style={styles.gpsPulse} />
          <Text style={styles.gpsFooterText}>
            Sharing location · Bus {sharingForBusId}
          </Text>
          <TouchableOpacity
            style={styles.gpsStopBtn}
            onPress={() => stopSharingGps("Tracking stopped")}
            activeOpacity={0.8}
          >
            <Text style={styles.gpsStopText}>Stop</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Draggable Bottom Sheet ── */}
      <BottomSheet
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        index={1}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.sheetHandle}
        enablePanDownToClose={false}
      >
        {/* Sheet header */}
        <BottomSheetView style={styles.sheetHeader}>
          <View style={styles.sheetHeaderRow}>
            <Text style={styles.sheetTitle}>
              {loadingBuses
                ? "Loading..."
                : `${buses.length} Bus${buses.length !== 1 ? "es" : ""} Available`}
            </Text>
            {activeBus && (
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => handleTrackBus(activeBus.id)}
              >
                <Text style={styles.clearBtnText}>Clear map</Text>
              </TouchableOpacity>
            )}
          </View>
          {!activeBus && !loadingBuses && (
            <Text style={styles.sheetHint}>
              Tap Track on a bus to see it on the map
            </Text>
          )}
        </BottomSheetView>

        <View style={styles.divider} />

        {/* List / Loading / Empty */}
        {loadingBuses ? (
          <BottomSheetView style={styles.loaderWrap}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loaderText}>Fetching buses…</Text>
          </BottomSheetView>
        ) : buses.length === 0 ? (
          <BottomSheetView style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>🚌</Text>
            <Text style={styles.emptyText}>No buses available</Text>
          </BottomSheetView>
        ) : (
          <BottomSheetFlatList<IBus>
            data={buses}
            keyExtractor={(item: IBus) => item.id.toString()}
            renderItem={renderBusCard}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </BottomSheet>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },

  // Header overlay
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
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  headerSub: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  livePillGreen: { backgroundColor: "#DCFCE7" },
  livePillYellow: { backgroundColor: "#FEF9C3" },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveDotGreen: { backgroundColor: "#16A34A" },
  liveDotYellow: { backgroundColor: "#CA8A04" },
  livePillText: { fontSize: 12, fontWeight: "700" },
  livePillTextGreen: { color: "#15803D" },
  livePillTextYellow: { color: "#A16207" },

  // Toast
  toast: {
    position: "absolute",
    alignSelf: "center",
    zIndex: 30,
    backgroundColor: "rgba(15,23,42,0.88)",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    maxWidth: "80%",
  },
  toastText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },

  // Bottom sheet
  sheetBg: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },
  sheetHandle: {
    backgroundColor: "#CBD5E1",
    width: 44,
    height: 4,
  },
  sheetHeader: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 14,
  },
  sheetHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  sheetHint: {
    fontSize: 13,
    color: "#94A3B8",
    marginTop: 4,
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#DC2626",
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginHorizontal: 20,
    marginBottom: 8,
  },

  // Loading / empty states
  loaderWrap: {
    alignItems: "center",
    paddingTop: 48,
    gap: 12,
  },
  loaderText: { fontSize: 14, color: "#94A3B8" },
  emptyWrap: {
    alignItems: "center",
    paddingTop: 48,
    gap: 10,
  },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontSize: 15, color: "#94A3B8", fontWeight: "500" },

  // Bus cards
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 48,
    gap: 10,
  },
  busCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  busCardActive: {
    borderColor: "#3B82F6",
    backgroundColor: "#EFF6FF",
  },
  busCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  busNumberPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: "#E2E8F0",
    borderRadius: 12,
  },
  busNumberPillActive: { backgroundColor: "#DBEAFE" },
  busNumberText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
    letterSpacing: 0.3,
  },
  busNumberTextActive: { color: "#1D4ED8" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusLive: { backgroundColor: "#DCFCE7" },
  statusEstimated: { backgroundColor: "#FEF9C3" },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  dotGreen: { backgroundColor: "#16A34A" },
  dotYellow: { backgroundColor: "#CA8A04" },
  statusLabel: { fontSize: 11, fontWeight: "700" },
  labelGreen: { color: "#15803D" },
  labelYellow: { color: "#A16207" },

  // Action button
  actionBtn: {
    backgroundColor: "#3B82F6",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 9,
    minWidth: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnStop: { backgroundColor: "#EF4444" },
  actionBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  // GPS sharing footer
  gpsFooter: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15,23,42,0.93)",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 25,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
  },
  gpsPulse: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#22C55E",
  },
  gpsFooterText: {
    flex: 1,
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  gpsStopBtn: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
  },
  gpsStopText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },

  // Map markers
  busMarkerWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 5,
    elevation: 6,
  },
  busMarkerCore: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
});
