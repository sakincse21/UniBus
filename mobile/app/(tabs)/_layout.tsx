import { Tabs } from "expo-router";
import * as Notifications from "expo-notifications";
import { AppState, View, Text } from "react-native";
import { useEffect } from "react";
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
import { useRouter } from "expo-router";
import { userAPI } from "@/lib/api";

const TabIcon = ({
  name,
  focused,
  iconChar,
}: {
  name: string;
  focused: boolean;
  iconChar: string;
}) => (
  <View className="items-center justify-center gap-1">
    <Text className={`text-2xl ${focused ? "text-blue-600" : "text-gray-500"}`}>
      {iconChar}
    </Text>
  </View>
);

export default function TabsLayout() {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const setPendingRequest = useBusTrackingStore((state) => state.setPendingRequest);
  const fetchCalendarEvents = useCalendarStore((state) => state.fetchCalendarEvents);

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

    const registerPushAndSyncCalendar = async () => {
      await syncPushTokenWithRetry();

      if (!cancelled) {
        await fetchCalendarEvents(30).catch(() => {});
      }
    };

    registerPushAndSyncCalendar();

    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextState) => {
        if (nextState === "active" && !cancelled) {
          syncPushTokenWithRetry().catch(() => {});
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
  }, [fetchCalendarEvents, user?.user_id]);

  useEffect(() => {
    requestNotificationPermissions().catch(() => {});

    let socket: any;

    const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data;

      if (data?.type === "notice") {
        router.push("/(tabs)");
        return;
      }

      if (data?.type !== "bus-tracking-request") return;

      const busId =
        typeof data.busId === "number" ? data.busId : Number(data.busId);
      if (!busId) return;

      const parsedRouteId =
        typeof data.routeId === "number" ? data.routeId : Number(data.routeId);

      const estimateData =
        typeof data.estimate === "object" && data.estimate
          ? (data.estimate as {
              lat?: number;
              lng?: number;
              confidence?: number;
            })
          : undefined;

      setPendingRequest({
        busId,
        routeId: Number.isFinite(parsedRouteId) ? parsedRouteId : null,
        estimate: estimateData
          ? {
              lat:
                typeof estimateData.lat === "number"
                  ? estimateData.lat
                  : undefined,
              lng:
                typeof estimateData.lng === "number"
                  ? estimateData.lng
                  : undefined,
              confidence:
                typeof estimateData.confidence === "number"
                  ? estimateData.confidence
                  : undefined,
            }
          : undefined,
      });
      router.push("/(tabs)/bus-tracking");
    };

    const init = async () => {
      socket = await getSocket();

      socket.on("bus_tracking_request", (payload: any) => {
        const trackingState = useBusTrackingStore.getState();
        if (
          trackingState.isSharingGps &&
          trackingState.sharingForBusId === payload.busId
        ) {
          return;
        }
        if (trackingState.isSharingGps) {
          return;
        }

        setPendingRequest({
          busId: payload.busId,
          routeId: payload.routeId || null,
          estimate: payload.estimate,
        });

        sendLocalNotification(
          `Bus ${payload.busId} location requested`,
          "Someone nearby asked if you are on this bus.",
          {
            type: "bus-tracking-request",
            busId: payload.busId,
            routeId: payload.routeId || null,
            estimate: payload.estimate,
          },
          "bus-tracking-requests",
        ).catch(() => {});
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
      }
      responseSubscription.remove();
    };
  }, [router, setPendingRequest]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#2563eb",
        tabBarInactiveTintColor: "#6b7280",
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopWidth: 1,
          borderTopColor: "#e5e7eb",
          paddingBottom: Math.max(insets.bottom, 12),
          paddingTop: 10,
          height: 70 + Math.max(insets.bottom, 0),
          paddingHorizontal: 4,
          elevation: 12,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.15,
          shadowRadius: 6,
        },
        tabBarItemStyle: {
          paddingVertical: 6,
          gap: 2,
          flex: 1,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "700",
          marginTop: 2,
        },
        sceneStyle: {
          backgroundColor: "#f9fafb",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Notices",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="Notices" focused={focused} iconChar="📢" />
          ),
        }}
      />
      <Tabs.Screen
        name="bus-tracking"
        options={{
          title: "Bus Track",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="Bus Track" focused={focused} iconChar="🚌" />
          ),
        }}
      />
      <Tabs.Screen
        name="weekly-routine"
        options={{
          title: "Routine",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="Routine" focused={focused} iconChar="📋" />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="Calendar" focused={focused} iconChar="📅" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="Profile" focused={focused} iconChar="👤" />
          ),
        }}
      />
    </Tabs>
  );
}
