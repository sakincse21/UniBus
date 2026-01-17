/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import BusMap from "@/components/BusMap";
import { Button } from "@/components/ui/button";
import { fetchBuses } from "@/lib/action/bus";
import { useEffect, useState } from "react";


export default function BusesPage() {
  const [buses, setBuses] = useState<any[]>([]);

  useEffect(() => {
    fetchBuses().then((res) => setBuses(res.data));
  }, []);

  const requestTracking = async (busId: number) => {
    await fetch(`/api/v1/tracking/request/${busId}`, {
      method: "POST",
      credentials: "include",
    });
  };

  return (
    <div className="w-full max-w-6xl h-full flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Live Bus Tracking</h1>

      <div className="flex gap-3 flex-wrap">
        {buses?.map((bus) => (
          <Button key={bus.id} onClick={() => requestTracking(bus.id)}>
            Track Bus {bus.busNumber}
          </Button>
        ))}
      </div>

      <div className="h-full">
        <BusMap />
      </div>
    </div>
  );
}
