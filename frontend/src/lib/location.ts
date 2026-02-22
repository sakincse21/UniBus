"use client";

import { getSocket } from "./socket";

let watchId: number | null = null;

export async function startLocationUpdates() {
  if (!navigator.geolocation) return;
  if (watchId !== null) return; // already running

  try {
    const socket = await getSocket();

    // Send an initial position immediately
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        socket.emit("location_update", {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {},
      { enableHighAccuracy: false, timeout: 10000 }
    );

    // Then watch for continuous changes
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        socket.emit("location_update", {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {},
      { enableHighAccuracy: false, maximumAge: 15000 }
    );
  } catch {
    // Socket not available yet — ignore silently
  }
}

export function stopLocationUpdates() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}
