"use client";

import {
  Map,
  MapControls,
  MapMarker,
  MarkerContent,
  MarkerPopup,
  MarkerTooltip,
} from "@/components/ui/map";
import { useEffect, useState } from "react";
import { getSocket } from "@/lib/socket";

type BusLocation = {
  busId: number;
  lng: number;
  lat: number;
  confidence: number;
};

export default function BusMap() {
  const [locations, setLocations] = useState<Record<number, BusLocation>>({});

  useEffect(() => {
    let socket: any;
    let mounted = true;

    const initSocket = async () => {
      try {
        socket = await getSocket();
        
        if (!socket) return;

        // Listen for bus location updates
        socket.on("bus_location_update", (data: BusLocation) => {
          if (mounted) {
            setLocations((prev) => ({
              ...prev,
              [data.busId]: data,
            }));
          }
        });

        // Request initial locations if backend supports it
        socket.emit("get_initial_locations");
        
        socket.on("initial_locations", (data: BusLocation[]) => {
          const newLocations: Record<number, BusLocation> = {};
          data.forEach(loc => {
            newLocations[loc.busId] = loc;
          });
          if (mounted) {
            setLocations(newLocations);
          }
        });

      } catch (error) {
        console.error("Failed to initialize socket:", error);
      }
    };

    initSocket();

    return () => {
      mounted = false;
      if (socket) {
        socket.off("bus_location_update");
        socket.off("initial_locations");
      }
    };
  }, []);

  return (
    <div className="w-full h-[600px] rounded-lg border shadow-sm">
      <Map center={[89.5, 22.9]} zoom={12}>
        <MapControls position="bottom-right"
          showZoom
          showCompass
          showLocate
          showFullscreen />  
        {Object.values(locations).map((bus) => (
          <MapMarker key={bus?.busId} latitude={bus?.lat} longitude={bus?.lng}>
            <MarkerContent>
              <div className="size-4 rounded-full bg-red-500 border-2 border-white shadow-lg" />
            </MarkerContent>
            <MarkerTooltip>Bus {bus.busId}</MarkerTooltip>
            <MarkerPopup>
              <div className="space-y-1">
                <p className="font-medium">Bus {bus.busId}</p>
                <p className="text-xs text-muted-foreground">
                  {bus?.lat.toFixed(4)}, {bus?.lng.toFixed(4)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Confidence: {(bus?.confidence * 100).toFixed(1)}%
                </p>
              </div>
            </MarkerPopup>
          </MapMarker>
        ))}
      </Map>
    </div>
  );
}