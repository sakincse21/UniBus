import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import config from "@/lib/config";
import storage from "@/lib/storage";

export const BACKGROUND_LOCATION_TASK_NAME = "tracku-background-location";

async function postLocationUpdate(lat: number, lng: number): Promise<void> {
  const token = await storage.getToken();
  if (!token) return;

  await fetch(`${config.API_BASE_URL}/location/update`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ lat, lng }),
  });
}

TaskManager.defineTask(BACKGROUND_LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error("Background location task error:", error.message);
    return;
  }

  const payload = data as
    | { locations?: Array<{ coords?: { latitude?: number; longitude?: number } }> }
    | undefined;

  const locations = payload?.locations;
  if (!Array.isArray(locations) || locations.length === 0) {
    return;
  }

  const latest = locations[locations.length - 1];
  const lat = latest?.coords?.latitude;
  const lng = latest?.coords?.longitude;

  if (typeof lat !== "number" || typeof lng !== "number") {
    return;
  }

  try {
    await postLocationUpdate(lat, lng);
  } catch (requestError) {
    console.error("Failed to sync background location:", requestError);
  }
});

export async function startBackgroundLocationTracking(): Promise<boolean> {
  try {
    const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK_NAME,
    );
    if (alreadyRunning) {
      return true;
    }

    const currentForeground = await Location.getForegroundPermissionsAsync();
    let foregroundStatus = currentForeground.status;

    if (foregroundStatus !== "granted") {
      foregroundStatus = (
        await Location.requestForegroundPermissionsAsync()
      ).status;
    }

    if (foregroundStatus !== "granted") {
      console.warn("Foreground location permission denied.");
      return false;
    }

    const currentBackground = await Location.getBackgroundPermissionsAsync();
    let backgroundStatus = currentBackground.status;

    if (backgroundStatus !== "granted") {
      backgroundStatus = (
        await Location.requestBackgroundPermissionsAsync()
      ).status;
    }

    if (backgroundStatus !== "granted") {
      console.warn("Background location permission denied.");
      return false;
    }

    try {
      const initial = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      await postLocationUpdate(initial.coords.latitude, initial.coords.longitude);
    } catch (error) {
      console.warn("Initial location sync skipped:", error);
    }

    const options: Location.LocationTaskOptions = {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 10000,
      distanceInterval: 0,
      mayShowUserSettingsDialog: true,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.OtherNavigation,
      showsBackgroundLocationIndicator: true,
    };

    if (Platform.OS === "android") {
      options.foregroundService = {
        notificationTitle: "TrackU location service is active",
        notificationBody:
          "Updating location in the background to ensure you never miss alerts.",
        notificationColor: "#2563eb",
        killServiceOnDestroy: false,
      };
    }

    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK_NAME, options);
    return true;
  } catch (error) {
    console.error("Failed to start background location tracking:", error);
    return false;
  }
}

export async function stopBackgroundLocationTracking(): Promise<void> {
  try {
    const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK_NAME,
    );

    if (alreadyRunning) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK_NAME);
    }
  } catch (error) {
    console.error("Failed to stop background location tracking:", error);
  }
}

export async function syncBackgroundLocationTracking(
  isAuthenticated: boolean,
): Promise<void> {
  if (isAuthenticated) {
    await startBackgroundLocationTracking();
    return;
  }

  await stopBackgroundLocationTracking();
}
