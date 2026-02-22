/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import { useEffect } from "react";
import { getSocket } from "@/lib/socket";
import BusTrackingModal from "@/components/BusTrackingModal";
import { Toaster } from "@/components/ui/sonner";
import { startLocationUpdates, stopLocationUpdates } from "@/lib/location";
import { toast } from "sonner";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Connect to socket and start sending location updates
  useEffect(() => {
    startLocationUpdates();
    return () => stopLocationUpdates();
  }, []);
  
  useEffect(() => {
    let socket: any;

    (async () => {
      socket = await getSocket();

      // Someone requested tracking — show the "are you on this bus?" modal
      socket.on("bus_tracking_request", (payload: any) => {
        window.dispatchEvent(
          new CustomEvent("BUS_TRACK_REQUEST", { detail: payload }),
        );
      });

      // A live tracking session started for a bus
      socket.on("bus_live_tracking_started", (payload: any) => {
        toast.success(`Live tracking started for Bus ${payload.busId}`);
      });

      // Tracking session ended (tracker stopped or disconnected)
      socket.on("bus_tracking_ended", (payload: any) => {
        window.dispatchEvent(
          new CustomEvent("BUS_TRACKING_ENDED", { detail: payload }),
        );
        toast.info(`Tracking ended for Bus ${payload.busId}`);
      });
    })();

    return () => {
      if (socket) {
        socket.off("bus_tracking_request");
        socket.off("bus_live_tracking_started");
        socket.off("bus_tracking_ended");
      }
    };
  }, []);

  return (
    <div className="h-full w-full">
        {children}
        <BusTrackingModal />
        <Toaster richColors />
      </div>
  );
}
