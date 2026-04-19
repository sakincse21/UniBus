/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getSocket } from "@/lib/socket";
import { DialogTitle } from "@radix-ui/react-dialog";
import { toast } from "sonner";

export default function BusTrackingModal() {
  const [open, setOpen] = useState(false);
  const [requestId, setRequestId] = useState<number | null>(null);
  const [busId, setBusId] = useState<number | null>(null);
  const [busNumber, setBusNumber] = useState<string | null>(null);
  const [routeId, setRouteId] = useState<number | null>(null);
  const [estimate, setEstimate] = useState<any>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [geoWatchId, setGeoWatchId] = useState<number | null>(null);
  const trackingBusLabel =
    busNumber && busNumber.trim().length > 0
      ? `Bus ${busNumber.trim()}`
      : busId != null
        ? `Bus ${busId}`
        : "this bus";

  // Clean up geo watch
  const clearGeoWatch = useCallback(() => {
    if (geoWatchId !== null) {
      navigator.geolocation.clearWatch(geoWatchId);
      setGeoWatchId(null);
    }
  }, [geoWatchId]);

  // Stop tracking entirely
  const stopTracking = useCallback(async () => {
    if (!busId) return;
    clearGeoWatch();
    try {
      const socket = await getSocket();
      socket.emit("stop_tracking", { busId });
      // Leave the route-specific room when stopping tracking
      socket.emit("leave_bus_route", { busId, routeId: routeId || undefined });
    } catch (e) {
      console.error("Failed to emit stop_tracking:", e);
    }
    setIsTracking(false);
    setBusId(null);
    setRequestId(null);
    setBusNumber(null);
    setRouteId(null);
    toast.info("Bus tracking stopped");
  }, [busId, routeId, clearGeoWatch]);

  // Listen for bus_track_request from layout
  useEffect(() => {
    const handler = (e: any) => {
      const parsedRequestId = Number(e.detail.requestId);
      setRequestId(Number.isFinite(parsedRequestId) ? parsedRequestId : null);
      setBusId(e.detail.busId);
      setBusNumber(
        typeof e.detail.busNumber === "string" ? e.detail.busNumber : null,
      );
      setRouteId(e.detail.routeId || null);
      setEstimate(e.detail.estimate);
      setOpen(true);
      window.dispatchEvent(
        new CustomEvent("BUS_ESTIMATE_UPDATE", {
          detail: {
            busId: e.detail.busId,
            ...e.detail.estimate,
          },
        }),
      );
    };

    window.addEventListener("BUS_TRACK_REQUEST", handler);
    return () => window.removeEventListener("BUS_TRACK_REQUEST", handler);
  }, []);

  // Listen for tracking_expired and bus_tracking_ended socket events
  useEffect(() => {
    let socket: any;

    const init = async () => {
      socket = await getSocket();

      socket.on("tracking_expired", (data: any) => {
        if (data.busId === busId || !busId) {
          clearGeoWatch();
          setIsTracking(false);
          if (busId) {
            // Leave the room when tracking expires
            socket.emit("leave_bus_route", { busId, routeId: routeId || undefined });
          }
          setBusId(null);
          setRequestId(null);
          setBusNumber(null);
          setRouteId(null);
          toast.warning("Bus tracking session has expired (schedule ended)");
          window.dispatchEvent(
            new CustomEvent("BUS_TRACKING_ENDED", { detail: data }),
          );
        }
      });

      socket.on("tracking_off_route", (data: any) => {
        if (data.busId === busId || !busId) {
          clearGeoWatch();
          setIsTracking(false);
          if (busId) {
            // Leave the room when tracking ends due to off-route
            socket.emit("leave_bus_route", { busId, routeId: routeId || undefined });
          }
          setBusId(null);
          setRequestId(null);
          setBusNumber(null);
          setRouteId(null);
          toast.warning(
            `Off-route detected (${data.dist}m from route). Tracking stopped.`
          );
          window.dispatchEvent(
            new CustomEvent("BUS_TRACKING_ENDED", { detail: data }),
          );
        }
      });

      socket.on("bus_tracking_ended", (data: any) => {
        window.dispatchEvent(
          new CustomEvent("BUS_TRACKING_ENDED", { detail: data }),
        );
      });
    };

    init();

    return () => {
      if (socket) {
        socket.off("tracking_expired");
        socket.off("tracking_off_route");
        socket.off("bus_tracking_ended");
      }
    };
  }, [busId, routeId, clearGeoWatch]);

  // Clean up geo watch on unmount
  useEffect(() => {
    return () => {
      if (geoWatchId !== null) {
        navigator.geolocation.clearWatch(geoWatchId);
      }
    };
  }, [geoWatchId]);

  const startTracking = async () => {
    if (!busId) return;

    const socket = await getSocket();

    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    const initialPosition = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
      });
    }).catch((err: GeolocationPositionError) => {
      toast.error("Location access error: " + err.message);
      return null;
    });

    if (!initialPosition) {
      return;
    }

    const initialLat = initialPosition.coords.latitude;
    const initialLng = initialPosition.coords.longitude;

    const ack = await new Promise<{ ok: boolean; message?: string }>((resolve) => {
      let settled = false;

      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve({ ok: false, message: "Timed out while starting sharing" });
      }, 5000);

      socket.emit(
        "accept_tracking",
        {
          busId,
          requestId:
            Number.isFinite(requestId) && Number(requestId) > 0
              ? Number(requestId)
              : undefined,
          lat: initialLat,
          lng: initialLng,
        },
        (response?: { ok?: boolean; message?: string }) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          resolve({
            ok: response?.ok === true,
            message: response?.message,
          });
        },
      );
    });

    if (!ack.ok) {
      toast.error(ack.message || "Could not start sharing for this bus");
      return;
    }

    // Join the route-specific room (or bus room if route not available) to receive only relevant location updates.
    socket.emit("view_bus_route", { busId, routeId: routeId || undefined });

    setOpen(false);
    setIsTracking(true);

    socket.emit("gps_update", {
      busId,
      lat: initialLat,
      lng: initialLng,
    });

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        socket.emit("gps_update", {
          busId,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => {
        console.error("Geo watch error:", err);
        socket.emit("stop_tracking", { busId });
        setIsTracking(false);
        toast.error("Location access error: " + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );

    setGeoWatchId(watchId);
    toast.success("Now tracking bus location. Keep the app open.");
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Are you currently on this bus?</DialogTitle>
          {estimate && (
            <p className="text-sm text-muted-foreground">
              {trackingBusLabel} estimated near ({estimate.lat?.toFixed(4)}, {estimate.lng?.toFixed(4)})
            </p>
          )}
          <div className="flex justify-end gap-4 mt-4">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              No
            </Button>
            <Button onClick={startTracking}>Yes, I&apos;m on this bus</Button>
          </div>
        </DialogContent>
      </Dialog>

      {isTracking && (
        <div className="fixed bottom-4 right-4 z-50 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg flex items-center gap-3">
          <div className="size-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm font-medium">Tracking {trackingBusLabel}</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={stopTracking}
          >
            Stop
          </Button>
        </div>
      )}
    </>
  );
}
