import { Tabs, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import {
  ActivityIndicator,
  AppState,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Feather } from "@expo/vector-icons";
import { useAuthStore } from "@/store/authStore";
import { useBusTrackingStore } from "@/store/busTrackingStore";
import { useCalendarStore } from "@/store/calendarStore";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getSocket } from "@/lib/socket";
import {
  initializePushNotifications,
  requestNotificationPermissions,
  sendLocalNotification,
} from "@/lib/notifications";
import { trackingAPI, userAPI } from "@/lib/api";
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

function parseNotificationRequestId(data: Record<string, unknown>): number | null {
  const raw = data.requestId;
  const parsed = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function TabsLayout() {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const normalizedRole = String(user?.role || "").toLowerCase();
  // Keep Forum visible while auth is hydrating to avoid transient tab disappearance.
  const showForumTab = isLoading || normalizedRole === "student" || normalizedRole === "cr";

  const fetchCalendarEvents = useCalendarStore((state) => state.fetchCalendarEvents);
  const pendingRequests = useBusTrackingStore((state) => state.pendingRequests);
  const shownRequestId = useBusTrackingStore((state) => state.shownRequestId);
  const setPendingRequests = useBusTrackingStore((state) => state.setPendingRequests);
  const removePendingRequest = useBusTrackingStore((state) => state.removePendingRequest);
  const setShownRequestId = useBusTrackingStore((state) => state.setShownRequestId);
  const setRequestToStartSharing = useBusTrackingStore(
    (state) => state.setRequestToStartSharing,
  );

  const [isRespondingRequestId, setIsRespondingRequestId] = useState<number | null>(
    null,
  );

  const refreshPendingTrackingRequests = useCallback(
    async (preferredRequestId?: number | null) => {
      if (!user?.user_id) return;

      try {
        const response = await trackingAPI.getPendingRequests();
        const requests = (response.data?.data || []) as ITrackingRequestItem[];
        setPendingRequests(requests);

        if (!requests.length) {
          setShownRequestId(null);
          return;
        }

        if (
          preferredRequestId &&
          requests.some((request) => request.id === preferredRequestId)
        ) {
          setShownRequestId(preferredRequestId);
          return;
        }

        if (!shownRequestId || !requests.some((request) => request.id === shownRequestId)) {
          setShownRequestId(requests[0].id);
        }
      } catch (error) {
        console.warn("Failed to fetch pending tracking requests:", error);
      }
    },
    [setPendingRequests, setShownRequestId, shownRequestId, user?.user_id],
  );

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
        await Promise.all([
          fetchCalendarEvents(30).catch(() => {}),
          refreshPendingTrackingRequests(),
        ]);
      }
    };

    registerPushAndSyncState();

    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextState) => {
        if (nextState === "active" && !cancelled) {
          syncPushTokenWithRetry().catch(() => {});
          refreshPendingTrackingRequests().catch(() => {});
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
  }, [fetchCalendarEvents, refreshPendingTrackingRequests, user?.user_id]);

  useEffect(() => {
    requestNotificationPermissions().catch(() => {});

    let socket: any;

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

      const requestId = parseNotificationRequestId(data);
      router.push("/(tabs)/bus-tracking");
      refreshPendingTrackingRequests(requestId).catch(() => {});
    };

    const init = async () => {
      socket = await getSocket();

      socket.on("bus_tracking_request", (payload: any) => {
        const trackingState = useBusTrackingStore.getState();
        const busId = Number(payload?.busId);

        if (
          trackingState.isSharingGps &&
          trackingState.sharingForBusId &&
          trackingState.sharingForBusId === busId
        ) {
          return;
        }

        const requestId = Number(payload?.requestId);
        refreshPendingTrackingRequests(Number.isFinite(requestId) ? requestId : null).catch(
          () => {},
        );

        sendLocalNotification(
          `Bus ${payload?.busId} tracking request`,
          "A nearby rider asked if you are currently on this bus.",
          {
            type: "TRACKING_REQUEST",
            requestId: payload?.requestId,
            busId: payload?.busId,
          },
          "bus-tracking-requests",
        ).catch(() => {});
      });

      socket.on("tracking_request_responded", () => {
        refreshPendingTrackingRequests().catch(() => {});
      });
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
      if (socket) {
        socket.off("bus_tracking_request");
        socket.off("tracking_request_responded");
      }
      responseSubscription.remove();
    };
  }, [refreshPendingTrackingRequests, router]);

  const activeRequest = useMemo(() => {
    if (!pendingRequests.length) {
      return null;
    }

    if (shownRequestId) {
      return pendingRequests.find((request) => request.id === shownRequestId) || null;
    }

    return pendingRequests[0];
  }, [pendingRequests, shownRequestId]);

  useEffect(() => {
    if (!pendingRequests.length) {
      if (shownRequestId !== null) {
        setShownRequestId(null);
      }
      return;
    }

    if (!shownRequestId || !pendingRequests.some((request) => request.id === shownRequestId)) {
      setShownRequestId(pendingRequests[0].id);
    }
  }, [pendingRequests, setShownRequestId, shownRequestId]);

  const respondToRequest = useCallback(
    async (status: "accepted" | "rejected") => {
      if (!activeRequest || isRespondingRequestId) {
        return;
      }

      setIsRespondingRequestId(activeRequest.id);

      try {
        await trackingAPI.respondToRequest(activeRequest.id, status);
        removePendingRequest(activeRequest.id);
        setShownRequestId(null);

        if (status === "accepted") {
          setRequestToStartSharing(activeRequest);
          router.push("/(tabs)/bus-tracking");
        }

        await refreshPendingTrackingRequests();
      } catch (error) {
        console.warn("Failed to respond to tracking request:", error);
        await refreshPendingTrackingRequests(activeRequest.id);
      } finally {
        setIsRespondingRequestId(null);
      }
    },
    [
      activeRequest,
      isRespondingRequestId,
      refreshPendingTrackingRequests,
      removePendingRequest,
      router,
      setRequestToStartSharing,
      setShownRequestId,
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
              <TabIcon focused={focused} iconName="truck" />
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
              {activeRequest?.requester.name} requested live location for Bus {activeRequest?.busId}.
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
