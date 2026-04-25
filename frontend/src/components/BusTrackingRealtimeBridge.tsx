"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { getSocket } from "@/lib/socket";
import { startLocationUpdates, stopLocationUpdates } from "@/lib/location";

type BusTrackingRequestPayload = {
  busId?: number;
  busNumber?: string | null;
  routeId?: number | null;
  expiresAt?: string | null;
  estimate?: {
    lat?: number;
    lng?: number;
    confidence?: number;
  };
};

function resolveBusLabel(payload: {
  busId?: number;
  busNumber?: string | null;
}): string | null {
  const normalizedBusNumber =
    typeof payload.busNumber === "string" ? payload.busNumber.trim() : "";

  if (normalizedBusNumber) {
    return `Bus ${normalizedBusNumber}`;
  }

  const busId = Number(payload.busId);
  if (Number.isFinite(busId)) {
    return `Bus ${busId}`;
  }

  return null;
}

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

  const busLabel = resolveBusLabel(payload);
  if (!busLabel) return;

  const body =
    payload.estimate?.lat != null && payload.estimate?.lng != null
      ? `Estimated near ${payload.estimate.lat.toFixed(4)}, ${payload.estimate.lng.toFixed(4)}.`
      : `Please confirm if you are currently on ${busLabel}.`;

  const tagBusId = Number(payload.busId);
  const tag = Number.isFinite(tagBusId)
    ? `bus-track-request-${tagBusId}`
    : `bus-track-request-${busLabel}`;

  const notification = new Notification(`${busLabel} location requested`, {
    body,
    tag,
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
      const expiresAtMs =
        typeof payload.expiresAt === "string"
          ? Date.parse(payload.expiresAt)
          : Number.NaN;
      if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
        return;
      }

      window.dispatchEvent(
        new CustomEvent("BUS_TRACK_REQUEST", { detail: payload }),
      );

      const busLabel = resolveBusLabel(payload);
      if (busLabel) {
        toast.info(`Location requested for ${busLabel}`);
      }

      showBusTrackingNotification(payload);
    };

    const onTrackingStarted = (payload: { busId?: number; busNumber?: string | null }) => {
      const busLabel = resolveBusLabel(payload);
      if (!busLabel) return;
      toast.success(`Live tracking started for ${busLabel}`);
    };

    const onTrackingEnded = (payload: { busId?: number; busNumber?: string | null }) => {
      window.dispatchEvent(
        new CustomEvent("BUS_TRACKING_ENDED", { detail: payload }),
      );

      const busLabel = resolveBusLabel(payload);
      if (!busLabel) return;
      toast.info(`Tracking ended for ${busLabel}`);
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