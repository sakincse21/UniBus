"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { getSocket } from "@/lib/socket";
import { startLocationUpdates, stopLocationUpdates } from "@/lib/location";

type BusTrackingRequestPayload = {
  busId?: number;
  routeId?: number | null;
  estimate?: {
    lat?: number;
    lng?: number;
    confidence?: number;
  };
};

function supportsBrowserNotifications(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

function requestBrowserNotificationPermission(): void {
  if (!supportsBrowserNotifications()) return;
  if (Notification.permission !== "default") return;

  Notification.requestPermission().catch(() => {
    // Ignore permission errors silently; in-app modal still works.
  });
}

function showBusTrackingNotification(payload: BusTrackingRequestPayload): void {
  if (!supportsBrowserNotifications()) return;
  if (Notification.permission !== "granted") return;

  const busId = Number(payload.busId);
  if (!Number.isFinite(busId)) return;

  const body =
    payload.estimate?.lat != null && payload.estimate?.lng != null
      ? `Estimated near ${payload.estimate.lat.toFixed(4)}, ${payload.estimate.lng.toFixed(4)}.`
      : "Please confirm if you are currently on this bus.";

  const notification = new Notification(`Bus ${busId} location requested`, {
    body,
    tag: `bus-track-request-${busId}`,
    requireInteraction: true,
  });

  notification.onclick = () => {
    window.focus();
    window.dispatchEvent(
      new CustomEvent("BUS_TRACK_REQUEST", { detail: payload }),
    );
    notification.close();
  };
}

export default function BusTrackingRealtimeBridge() {
  useEffect(() => {
    startLocationUpdates();

    return () => {
      stopLocationUpdates();
    };
  }, []);

  useEffect(() => {
    const enablePrompt = () => {
      requestBrowserNotificationPermission();
    };

    window.addEventListener("pointerdown", enablePrompt, { once: true });
    window.addEventListener("keydown", enablePrompt, { once: true });

    return () => {
      window.removeEventListener("pointerdown", enablePrompt);
      window.removeEventListener("keydown", enablePrompt);
    };
  }, []);

  useEffect(() => {
    let socket: Awaited<ReturnType<typeof getSocket>> | null = null;

    const onBusTrackingRequest = (payload: BusTrackingRequestPayload) => {
      window.dispatchEvent(
        new CustomEvent("BUS_TRACK_REQUEST", { detail: payload }),
      );

      const busId = Number(payload.busId);
      if (Number.isFinite(busId)) {
        toast.info(`Location requested for Bus ${busId}`);
      }

      showBusTrackingNotification(payload);
    };

    const onTrackingStarted = (payload: { busId?: number }) => {
      const busId = Number(payload?.busId);
      if (!Number.isFinite(busId)) return;
      toast.success(`Live tracking started for Bus ${busId}`);
    };

    const onTrackingEnded = (payload: { busId?: number }) => {
      window.dispatchEvent(
        new CustomEvent("BUS_TRACKING_ENDED", { detail: payload }),
      );

      const busId = Number(payload?.busId);
      if (!Number.isFinite(busId)) return;
      toast.info(`Tracking ended for Bus ${busId}`);
    };

    (async () => {
      try {
        socket = await getSocket();
        socket.on("bus_tracking_request", onBusTrackingRequest);
        socket.on("bus_live_tracking_started", onTrackingStarted);
        socket.on("bus_tracking_ended", onTrackingEnded);
      } catch {
        // Ignore socket failures here; existing polling and manual flows still work.
      }
    })();

    return () => {
      if (!socket) return;
      socket.off("bus_tracking_request", onBusTrackingRequest);
      socket.off("bus_live_tracking_started", onTrackingStarted);
      socket.off("bus_tracking_ended", onTrackingEnded);
    };
  }, []);

  return null;
}