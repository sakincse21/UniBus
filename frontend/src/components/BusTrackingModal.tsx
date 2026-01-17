/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getSocket } from "@/lib/socket";
import { DialogTitle } from "@radix-ui/react-dialog";

let geoWatchId: number | null = null;

export default function BusTrackingModal() {
  const [open, setOpen] = useState(false);
  const [busId, setBusId] = useState<number | null>(null);

  useEffect(() => {
    const handler = (e: any) => {
      setBusId(e.detail.busId);
      setOpen(true);
    };

    window.addEventListener("BUS_TRACK_REQUEST", handler);
    return () =>
      window.removeEventListener("BUS_TRACK_REQUEST", handler);
  }, []);

  const startTracking = async () => {
    if (!busId) return;

    const socket = await getSocket();
    socket.emit("accept_tracking", { busId });

    setOpen(false);

    if (!navigator.geolocation) return;

    geoWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        console.log(pos)
        socket.emit("gps_update", {
          busId,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      console.error,
      { enableHighAccuracy: true }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogTitle>Are you currently on this bus?</DialogTitle>
        <div className="flex justify-end gap-4 mt-4">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            No
          </Button>
          <Button onClick={startTracking}>Yes</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
