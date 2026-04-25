import { Tabs, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import {
  Alert,
  ActivityIndicator,
  AppState,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import { Feather } from "@expo/vector-icons";
import { useAuthStore } from "@/store/authStore";
import { useBusTrackingStore } from "@/store/busTrackingStore";
import { useCalendarStore } from "@/store/calendarStore";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getSocket } from "@/lib/socket";
import {
  getPushTokenBlockReason,
  initializePushNotifications,
  isPushTokenRegistrationBlocked,
  requestNotificationPermissions,
  sendLocalNotification,
} from "@/lib/notifications";
import { locationAPI, trackingAPI, userAPI } from "@/lib/api";
import { ITrackingRequestItem } from "@/interfaces";
import { APP_THEME_COLORS } from "@/lib/theme";

const COLORS = APP_THEME_COLORS;

const TabIcon = ({
  focused,
  iconName,
}: {
  focused: boolean;
  iconName: React.ComponentProps<typeof Feather>["name"];
}) => (
  <View style={{ alignItems: "center", justifyContent: "center" }}>
    <View
      style={{
        width: focused ? 44 : 40,
        height: focused ? 36 : 34,
        borderRadius: 11,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: focused ? COLORS.primarySoft : COLORS.surfaceLow,
        borderWidth: 1,
        borderColor: focused ? "#A2C3F8" : "#D8DAE5",
      }}
    >
      <Feather
        name={iconName}
        size={20}
        color={focused ? COLORS.primary : COLORS.onSurfaceMuted}
      />
    </View>
  </View>
);

function formatBusLabel(busId: number, busNumber?: string | null): string {
  const normalizedBusNumber =
    typeof busNumber === "string" ? busNumber.trim() : "";
  return `Bus ${normalizedBusNumber || String(busId)}`;
}

function parseNumericId(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isRequestExpired(expiresAt?: string | null): boolean {
  if (!expiresAt) return false;
  const expiresAtMs = Date.parse(expiresAt);
  return Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now();
}

function buildFallbackRequestFromNotification(
  data: Record<string, unknown>,
): ITrackingRequestItem | null {
  const requestId = parseNumericId(data.requestId);
  const busId = parseNumericId(data.busId);

  if (requestId === null || busId === null) {
    return null;
  }

  const busNumber =
    typeof data.busNumber === "string" ? data.busNumber : null;
  const expiresAt =
    typeof data.expiresAt === "string" ? data.expiresAt : null;

  if (isRequestExpired(expiresAt)) {
    return null;
  }

  return {
    id: requestId,
    busId,
    busNumber,
    status: "pending",
    createdAt: new Date().toISOString(),
    expiresAt,
    requester: {
      userId: "",
      name: "A nearby rider",
      email: "",
    },
  };
}

export default function TabsLayout() {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const normalizedRole = String(user?.role || "").toLowerCase();
  // Keep Forum visible while auth is hydrating to avoid transient tab disappearance.
  const showForumTab = isLoading || normalizedRole === "student" || normalizedRole === "cr";

  const fetchCalendarEvents = useCalendarStore((state) => state.fetchCalendarEvents);
  const setRequestToStartSharing = useBusTrackingStore(
    (state) => state.setRequestToStartSharing,
  );
  const ignoredRequestIdsRef = useRef<Set<number>>(new Set());
  const [activeRequest, setActiveRequest] = useState<ITrackingRequestItem | null>(
    null,
  );

  const [isRespondingRequestId, setIsRespondingRequestId] = useState<number | null>(
    null,
  );
  const activeRequestBusLabel = activeRequest
    ? formatBusLabel(activeRequest.busId, activeRequest.busNumber)
    : "this bus";

  const fetchLatestPendingRequest = useCallback(async () => {
    try {
      const response = await trackingAPI.getPendingRequests();
      const pending = Array.isArray(response.data?.data)
        ? (response.data.data as ITrackingRequestItem[])
        : [];

      const latestPending = [...pending]
        .filter((request) => {
          const requestId = parseNumericId(request?.id);
          if (requestId !== null && ignoredRequestIdsRef.current.has(requestId)) {
            return false;
          }

          return (
            requestId !== null &&
            parseNumericId(request?.busId) !== null &&
            !isRequestExpired(request?.expiresAt)
          );
        })
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )[0];

      if (latestPending) {
        setActiveRequest((current) => {
          if (current?.id === latestPending.id) {
            return current;
          }
          return latestPending;
        });
      } else {
        setActiveRequest((current) => {
          if (!current) return null;
          return isRequestExpired(current.expiresAt) ? null : current;
        });
      }
    } catch {
      // Keep current modal state if fetch fails.
    }
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !user?.user_id) {
      router.replace("/(auth)/login");
    }
  }, [isAuthenticated, isLoading, router, user?.user_id]);

  useEffect(() => {
    if (!user?.user_id) return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const syncPushTokenWithRetry = async (attempt = 0): Promise<void> => {
      const pushToken = await initializePushNotifications();

      if (!pushToken) {
        if (isPushTokenRegistrationBlocked()) {
          const reason = getPushTokenBlockReason();
          if (reason) {
            console.warn("Push token sync paused:", reason);
          }
          return;
        }

        if (!cancelled && attempt < 3) {
          retryTimer = setTimeout(() => {
            syncPushTokenWithRetry(attempt + 1).catch(() => {});
          }, 3000 * (attempt + 1));
        }
        return;
      }

      try {
        await userAPI.updatePushToken(pushToken);
      } catch (error) {
        console.warn("Failed to update push token:", error);
        if (!cancelled && attempt < 5) {
          retryTimer = setTimeout(() => {
            syncPushTokenWithRetry(attempt + 1).catch(() => {});
          }, Math.min(30000, 2000 * 2 ** attempt));
        }
      }
    };

    const registerPushAndSyncState = async () => {
      await syncPushTokenWithRetry();

      if (!cancelled) {
        await fetchCalendarEvents(30).catch(() => {});
        await fetchLatestPendingRequest();
      }
    };

    registerPushAndSyncState();

    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextState) => {
        if (nextState === "active" && !cancelled) {
          syncPushTokenWithRetry().catch(() => {});
          fetchLatestPendingRequest().catch(() => {});
        }
      },
    );

    return () => {
      cancelled = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      appStateSubscription.remove();
    };
  }, [fetchCalendarEvents, fetchLatestPendingRequest, user?.user_id]);

  useEffect(() => {
    if (!user?.user_id) return;

    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    const syncLocation = async (lat: number, lng: number) => {
      await locationAPI.updateLocation(lat, lng).catch(() => {});

      try {
        const socket = await getSocket();
        socket.emit("location_update", { lat, lng });
      } catch {
        // Keep API location sync as fallback when socket is reconnecting.
      }
    };

    const startForegroundLocationSync = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted" || cancelled) {
          return;
        }

        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (!cancelled) {
          await syncLocation(current.coords.latitude, current.coords.longitude);
        }

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 15000,
            distanceInterval: 25,
          },
          (position) => {
            if (cancelled) return;
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            syncLocation(lat, lng).catch(() => {});
          },
        );
      } catch {
        // Non-fatal. Request and tracking fallback still work via sockets when available.
      }
    };

    startForegroundLocationSync().catch(() => {});

    return () => {
      cancelled = true;
      subscription?.remove();
      subscription = null;
    };
  }, [user?.user_id]);

  useEffect(() => {
    if (!user?.user_id) return;

    requestNotificationPermissions().catch(() => {});

    let socket: any;
    let removeSocketConnectListener: (() => void) | null = null;
    let pendingPollTimer: ReturnType<typeof setInterval> | null = null;

    const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
      const rawData = response.notification.request.content.data;
      const data = (rawData || {}) as Record<string, unknown>;
      const type = String(data.type || "");

      if (type === "notice") {
        router.push("/(tabs)");
        return;
      }

      if (type !== "TRACKING_REQUEST" && type !== "bus-tracking-request") {
        return;
      }

      const fallbackRequest = buildFallbackRequestFromNotification(data);
      if (fallbackRequest) {
        if (ignoredRequestIdsRef.current.has(fallbackRequest.id)) {
          return;
        }

        setActiveRequest((current) => {
          if (current?.id === fallbackRequest.id) {
            return current;
          }
          return fallbackRequest;
        });
      } else {
        fetchLatestPendingRequest().catch(() => {});
      }

      router.push("/(tabs)/bus-tracking");
    };

    const init = async () => {
      socket = await getSocket();

      const handleSocketConnect = () => {
        fetchLatestPendingRequest().catch(() => {});
      };

      socket.on("connect", handleSocketConnect);
      removeSocketConnectListener = () => {
        socket.off("connect", handleSocketConnect);
      };

      socket.on("bus_tracking_request", (payload: any) => {
        const trackingState = useBusTrackingStore.getState();
        const busId = parseNumericId(payload?.busId);
        const expiresAtRaw =
          typeof payload?.expiresAt === "string" ? payload.expiresAt : null;

        if (busId === null || isRequestExpired(expiresAtRaw)) {
          return;
        }

        if (
          trackingState.isSharingGps &&
          trackingState.sharingForBusId &&
          trackingState.sharingForBusId === busId
        ) {
          return;
        }

        const requestId = parseNumericId(payload?.requestId);
        if (requestId === null) {
          return;
        }

        if (ignoredRequestIdsRef.current.has(requestId)) {
          return;
        }

        const busNumber =
          typeof payload?.busNumber === "string" ? payload.busNumber : null;
        const busLabel = formatBusLabel(busId, busNumber);

        const incomingRequest: ITrackingRequestItem = {
          id: requestId,
          busId,
          busNumber,
          status: "pending",
          createdAt:
            typeof payload?.createdAt === "string"
              ? payload.createdAt
              : new Date().toISOString(),
          expiresAt:
            typeof payload?.expiresAt === "string" ? payload.expiresAt : null,
          requester: {
            userId: String(payload?.requester?.userId || ""),
            name: String(payload?.requester?.name || "A nearby rider"),
            email: String(payload?.requester?.email || ""),
          },
        };

        setActiveRequest((current) => {
          if (current?.id === incomingRequest.id) {
            return current;
          }
          return incomingRequest;
        });

        sendLocalNotification(
          `${busLabel} tracking request`,
          `A nearby rider asked if you are currently on ${busLabel}.`,
          {
            type: "TRACKING_REQUEST",
            requestId: payload?.requestId,
            busId: payload?.busId,
            busNumber,
            expiresAt: expiresAtRaw,
          },
          "bus-tracking-requests",
        ).catch(() => {});
      });

      fetchLatestPendingRequest().catch(() => {});

      // Fallback poll keeps pending request modal reliable when a socket event is missed.
      pendingPollTimer = setInterval(() => {
        fetchLatestPendingRequest().catch(() => {});
      }, 12000);
    };

    init();

    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener(
        handleNotificationResponse,
      );

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          handleNotificationResponse(response);
        }
      })
      .catch(() => {});

    return () => {
      removeSocketConnectListener?.();
      if (pendingPollTimer) {
        clearInterval(pendingPollTimer);
      }
      if (socket) {
        socket.off("bus_tracking_request");
      }
      responseSubscription.remove();
    };
  }, [fetchLatestPendingRequest, router, user?.user_id]);

  const respondToRequest = useCallback(
    async (status: "accepted" | "rejected") => {
      if (!activeRequest || isRespondingRequestId) {
        return;
      }

      const request = activeRequest;
      ignoredRequestIdsRef.current.add(request.id);
      setIsRespondingRequestId(request.id);
      // Close immediately so the modal does not feel stuck on slow/failed requests.
      setActiveRequest(null);

      if (status === "accepted") {
        try {
          await trackingAPI.respondToRequest(request.id, "accepted");
        } catch (error) {
          const responseStatus = Number((error as any)?.response?.status);

          if (responseStatus !== 404 && responseStatus !== 410) {
            console.warn("Failed to pre-accept tracking request:", error);
          }
        }

        // Let the tracking socket acceptance path atomically accept+start sharing.
        setRequestToStartSharing(request);
        router.push("/(tabs)/bus-tracking");
        setIsRespondingRequestId(null);
        return;
      }

      try {
        await trackingAPI.respondToRequest(request.id, "rejected");
      } catch (error) {
        const responseStatus = Number((error as any)?.response?.status);
        const responseMessage =
          typeof (error as any)?.response?.data?.message === "string"
            ? (error as any).response.data.message
            : "Unable to reject this request. Please try again.";

        if (responseStatus !== 404 && responseStatus !== 410) {
          ignoredRequestIdsRef.current.delete(request.id);
          setActiveRequest(request);
        }

        Alert.alert("Tracking Request", responseMessage);
        console.warn("Failed to respond to tracking request:", error);
      } finally {
        setIsRespondingRequestId(null);
      }
    },
    [
      activeRequest,
      isRespondingRequestId,
      router,
      setRequestToStartSharing,
    ],
  );

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: COLORS.onSurfaceMuted,
          tabBarStyle: {
            backgroundColor: COLORS.surface,
            borderWidth: 1,
            borderColor: COLORS.outline,
            borderRadius: 18,
            marginHorizontal: 12,
            marginBottom: 14,
            paddingBottom: Math.max(insets.bottom, 10),
            paddingTop: 10,
            height: 70 + Math.max(insets.bottom, 0),
            paddingHorizontal: 8,
            elevation: 16,
            shadowColor: "#111827",
            shadowOffset: { width: 0, height: -1 },
            shadowOpacity: 0.1,
            shadowRadius: 10,
          },
          tabBarItemStyle: {
            paddingVertical: 6,
            flex: 1,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: "700",
            marginTop: 2,
          },
          sceneStyle: {
            backgroundColor: COLORS.background,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Notices",
            tabBarIcon: ({ focused }) => (
              <TabIcon focused={focused} iconName="bell" />
            ),
          }}
        />
        <Tabs.Screen
          name="forum"
          options={{
            title: "Forum",
            ...(showForumTab ? {} : { href: null }),
            tabBarIcon: ({ focused }) => (
              <TabIcon focused={focused} iconName="message-circle" />
            ),
          }}
        />
        <Tabs.Screen
          name="bus-tracking"
          options={{
            title: "Bus Track",
            tabBarIcon: ({ focused }) => (
              <TabIcon focused={focused} iconName="map-pin" />
            ),
          }}
        />
        <Tabs.Screen
          name="weekly-routine"
          options={{
            title: "Routine",
            tabBarIcon: ({ focused }) => (
              <TabIcon focused={focused} iconName="clipboard" />
            ),
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: "Calendar",
            tabBarIcon: ({ focused }) => (
              <TabIcon focused={focused} iconName="calendar" />
            ),
          }}
        />
      </Tabs>

      <Modal visible={Boolean(activeRequest)} transparent animationType="fade">
        <View className="flex-1 bg-black/55 items-center justify-center px-5">
          <View
            className="w-full max-w-md rounded-2xl p-5"
            style={{
              backgroundColor: COLORS.surface,
              borderWidth: 1,
              borderColor: COLORS.outline,
            }}
          >
            <Text className="text-lg font-bold" style={{ color: COLORS.onSurface }}>
              Bus Tracking Request
            </Text>
            <Text className="mt-3 text-sm" style={{ color: COLORS.onSurfaceMuted }}>
              {activeRequest?.requester.name} requested live location for {activeRequestBusLabel}.
            </Text>
            <Text className="mt-1 text-xs" style={{ color: COLORS.onSurfaceMuted }}>
              Requester: {activeRequest?.requester.email}
            </Text>
            <Text className="mt-1 text-xs" style={{ color: COLORS.onSurfaceMuted }}>
              Received: {activeRequest ? new Date(activeRequest.createdAt).toLocaleString() : ""}
            </Text>

            <View className="mt-5 flex-row gap-3">
              <TouchableOpacity
                className="flex-1 rounded-lg py-3 items-center"
                style={{
                  borderWidth: 1,
                  borderColor: "#F3B9B9",
                  backgroundColor: COLORS.dangerSoft,
                }}
                onPress={() => respondToRequest("rejected")}
                disabled={isRespondingRequestId === activeRequest?.id}
              >
                {isRespondingRequestId === activeRequest?.id ? (
                  <ActivityIndicator size="small" color={COLORS.danger} />
                ) : (
                  <Text className="font-semibold" style={{ color: COLORS.danger }}>
                    Reject
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 rounded-lg py-3 items-center"
                style={{
                  backgroundColor: COLORS.primary,
                  borderWidth: 1,
                  borderColor: COLORS.primary,
                }}
                onPress={() => respondToRequest("accepted")}
                disabled={isRespondingRequestId === activeRequest?.id}
              >
                {isRespondingRequestId === activeRequest?.id ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text className="font-semibold text-white">Accept</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
