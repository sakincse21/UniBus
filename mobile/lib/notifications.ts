import { Platform } from "react-native";

// Configure how notifications should be handled
// Note: Push notifications require a development build
// Expo Go removed Android Push notifications support in SDK 53

export async function initializePushNotifications() {
  try {
    // In Expo Go, push notifications are not fully supported
    if (Platform.OS === "android") {
      console.log(
        "Push notifications are not available in Expo Go for Android. Use a development build for production apps.",
      );
      return null;
    }

    // For development, we can skip token generation
    if (process.env.NODE_ENV === "development") {
      console.debug("Push notifications disabled in development mode");
      return null;
    }

    return null;
  } catch (error) {
    console.debug("Notification initialization skipped (Expo Go limitation)");
    return null;
  }
}

export async function scheduleNotification(
  title: string,
  body: string,
  seconds: number = 10,
) {
  try {
    console.debug(`Scheduled notification would be: ${title} - ${body}`);
    // Full implementation requires development build
  } catch (error) {
    console.debug("Error scheduling notification (Expo Go limitation):", error);
  }
}

export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, any>,
) {
  try {
    console.debug(`Local notification would be: ${title} - ${body}`);
    // Full implementation requires development build
  } catch (error) {
    console.debug(
      "Error sending local notification (Expo Go limitation):",
      error,
    );
  }
}

export function setupNotificationListeners(
  onNotificationReceived?: (notification: any) => void,
  onNotificationTapped?: (response: any) => void,
) {
  // Return empty cleanup function for Expo Go
  console.debug(
    "Notification listeners not available in Expo Go. Use a development build.",
  );
  return () => {
    // Cleanup function
  };
}

export async function cancelAllScheduledNotifications() {
  try {
    console.debug("Notification cancellation not available in Expo Go.");
  } catch (error) {
    console.debug("Error canceling notifications (Expo Go limitation):", error);
  }
}
