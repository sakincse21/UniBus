import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Alert, Platform } from "react-native";

let channelsInitialized = false;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function getExpoProjectId(): string | null {
  const constantsAny = Constants as any;

  const fromExpoConfig = Constants.expoConfig?.extra?.eas?.projectId;
  const fromEasConfig = constantsAny?.easConfig?.projectId;
  const fromManifest2 =
    constantsAny?.manifest2?.extra?.expoClient?.extra?.eas?.projectId;
  const fromManifest = constantsAny?.manifest?.extra?.eas?.projectId;

  return (
    fromExpoConfig || fromEasConfig || fromManifest2 || fromManifest || null
  );
}

export async function ensureNotificationChannels(): Promise<void> {
  if (Platform.OS !== "android" || channelsInitialized) {
    return;
  }

  await Notifications.setNotificationChannelAsync("routine-reminders", {
    name: "Class Reminders",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#2563eb",
    enableVibrate: true,
    enableLights: true,
  });

  await Notifications.setNotificationChannelAsync("bus-tracking-requests", {
    name: "Bus Tracking Alerts",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 300, 150, 300],
    lightColor: "#2563eb",
    enableVibrate: true,
    enableLights: true,
  });

  await Notifications.setNotificationChannelAsync("notice-updates", {
    name: "Notice Updates",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 200, 250],
    lightColor: "#2563eb",
    enableVibrate: true,
    enableLights: true,
  });

  await Notifications.setNotificationChannelAsync("calendar-reminders", {
    name: "Calendar Reminders",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 150, 200],
    lightColor: "#2563eb",
    enableVibrate: true,
    enableLights: true,
  });

  channelsInitialized = true;
}

export async function requestNotificationPermissions(
  showAlertOnDeny = true,
): Promise<boolean> {
  try {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      if (showAlertOnDeny) {
        Alert.alert(
          "Permission Needed",
          "Please allow notifications to receive bus tracking, notice, and calendar reminders.",
        );
      }
      return false;
    }

    await ensureNotificationChannels();
    return true;
  } catch (error) {
    console.error("Notification permission error:", error);
    return false;
  }
}

export async function initializePushNotifications(): Promise<string | null> {
  const granted = await requestNotificationPermissions(false);
  if (!granted) {
    console.log("Notification permissions not granted, skipping push token");
    return null;
  }

  const projectId = getExpoProjectId();
  if (!projectId) {
    console.warn("Expo projectId not found. Push token registration skipped.");
    return null;
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    console.log("Push token obtained successfully");
    return token.data;
  } catch (error: any) {
    // This error is expected in development builds without FCM configured
    // Expo Go on Android SDK 53+ cannot provide push tokens
    if (error?.code === "E_REGISTRATION_FAILED") {
      console.log(
        "Push notifications not configured for this build - this is normal for development",
      );
      return null;
    }
    console.warn("Failed to get Expo push token:", error?.message || error);
    return null;
  }
}

export async function scheduleNotification(
  title: string,
  body: string,
  seconds: number = 10,
) {
  const granted = await requestNotificationPermissions(false);
  if (!granted) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      ...(Platform.OS === "android" ? { channelId: "calendar-reminders" } : {}),
    },
  });
}

export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, any>,
) {
  const granted = await requestNotificationPermissions(false);
  if (!granted) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: null,
  });
}

export function setupNotificationListeners(
  onNotificationReceived?: (notification: Notifications.Notification) => void,
  onNotificationTapped?: (response: Notifications.NotificationResponse) => void,
) {
  const receivedSubscription = onNotificationReceived
    ? Notifications.addNotificationReceivedListener(onNotificationReceived)
    : null;

  const responseSubscription = onNotificationTapped
    ? Notifications.addNotificationResponseReceivedListener(
        onNotificationTapped,
      )
    : null;

  return () => {
    receivedSubscription?.remove();
    responseSubscription?.remove();
  };
}

export async function cancelAllScheduledNotifications() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error("Error canceling scheduled notifications:", error);
  }
}
