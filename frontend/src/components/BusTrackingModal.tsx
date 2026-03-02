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
  const [busId, setBusId] = useState<number | null>(null);
  const [estimate, setEstimate] = useState<any>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [geoWatchId, setGeoWatchId] = useState<number | null>(null);

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
    } catch (e) {
      console.error("Failed to emit stop_tracking:", e);
    }
    setIsTracking(false);
    setBusId(null);
    toast.info("Bus tracking stopped");
  }, [busId, clearGeoWatch]);

  // Listen for bus_track_request from layout
  useEffect(() => {
    const handler = (e: any) => {
      setBusId(e.detail.busId);
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
          setBusId(null);
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
          setBusId(null);
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
  }, [busId, clearGeoWatch]);

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
    socket.emit("accept_tracking", { busId });

    setOpen(false);
    setIsTracking(true);

    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

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
        toast.error("Location access error: " + err.message);
      },
      { enableHighAccuracy: true },
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
              Bus estimated near ({estimate.lat?.toFixed(4)}, {estimate.lng?.toFixed(4)})
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
          <span className="text-sm font-medium">Tracking Bus {busId}</span>
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
