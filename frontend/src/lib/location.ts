"use client";

import { configs } from "./config.env";

let intervalId: number | null = null;

export function startLocationUpdates() {
  if (!navigator.geolocation) return;

  if (intervalId) return; // already running

  intervalId = window.setInterval(() => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await fetch(`${configs.BACKEND_BASE_URL}/location/update`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
        });
      },
      () => {},
      { enableHighAccuracy: false }
    );
  }, 5000); // every 20 seconds
}
