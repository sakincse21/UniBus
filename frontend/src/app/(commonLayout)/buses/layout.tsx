/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import { useEffect } from "react";
import { getSocket } from "@/lib/socket";
import BusTrackingModal from "@/components/BusTrackingModal";
import { Toaster } from "@/components/ui/sonner";
import { startLocationUpdates } from "@/lib/location";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(()=>{
    startLocationUpdates()
  },[])
  useEffect(() => {
    let socket: any;

    (async () => {
      socket = await getSocket();

      socket.on("bus_tracking_request", (payload: any) => {
        window.dispatchEvent(
          new CustomEvent("BUS_TRACK_REQUEST", { detail: payload }),
        );
      });
    })();

    return () => {
      if (socket) {
        socket.off("bus_tracking_request");
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
