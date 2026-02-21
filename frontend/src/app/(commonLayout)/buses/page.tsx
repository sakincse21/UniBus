// /* eslint-disable @typescript-eslint/no-explicit-any */
// "use client";

// import BusMap from "@/components/BusMap";
// import { Button } from "@/components/ui/button";
// import { fetchBuses } from "@/lib/action/bus";
// import { useEffect, useState } from "react";
// import { set } from "zod";

// export default function BusesPage() {
//   const [buses, setBuses] = useState<any[]>([]);
//   const [points, setPoints] = useState<any[]>([]);

//   useEffect(() => {
//     fetchBuses().then((res) => setBuses(res.data));
//     window.navigator.geolocation.getCurrentPosition(
//       async (pos) => {
//         const res = await fetch(`/api/v1/location/update`, {
//           method: "POST",
//           credentials: "include",
//           headers: {
//             "Content-Type": "application/json",
//           },
//           body: JSON.stringify({
//             lat: pos.coords.latitude,
//             lng: pos.coords.longitude,
//           }),
//         });
//         console.log('location jacche: ',res.json())
//       },
//       () => {},
//       { enableHighAccuracy: false },
//     );
//   }, []);

//   // const requestTracking = async (busId: number) => {
//   //   await fetch(`/api/v1/tracking/request/${busId}`, {
//   //     method: "POST",
//   //     credentials: "include",
//   //   });
//   // };

//   const handleRequestTracking = async (busId: number) => {
//     try {
//       const res = await fetch(`/api/v1/tracking/request/${busId}`, {
//         method: "POST",
//         credentials: "include",
//       });

//       if (!res.ok) {
//         throw new Error("Failed to request tracking");
//       }

//       console.log(res);

//       // Optionally, you can handle the response here
//       const data = await res.json();
//       setPoints(data.points || []); // Clear previous points when requesting new tracking
//       console.log("Tracking requested:", data);
//     } catch (error) {
//       console.error("Error requesting tracking:", error);
//     }
//   };

//   return (
//     <div className="w-full max-w-6xl h-full flex flex-col gap-6">
//       <h1 className="text-2xl font-bold">Live Bus Tracking</h1>

//       <div className="flex gap-3 flex-wrap">
//         {buses?.map((bus) => (
//           <Button key={bus.id} onClick={() => handleRequestTracking(bus.id)}>
//             Track Bus {bus.busNumber}
//           </Button>
//         ))}
//       </div>

//       <div className="h-full">
//         <BusMap points={points} />
//       </div>
//     </div>
//   );
// }

/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import BusMap from "@/components/BusMap";
import { Button } from "@/components/ui/button";
import { fetchBuses } from "@/lib/action/bus";
import { useEffect, useState } from "react";

type LocationState = "idle" | "requesting" | "granted" | "denied" | "error" | "skipped";

export default function BusesPage() {
  const [buses, setBuses] = useState<any[]>([]);
  const [points, setPoints] = useState<any[]>([]);
  const [locationStatus, setLocationStatus] = useState<LocationState>("idle");
  const [locationError, setLocationError] = useState<string>("");
  const [isLocationSkipped, setIsLocationSkipped] = useState(false);

  // 🎯 Force location on mount - but allow skip
  useEffect(() => {
    if (isLocationSkipped) return; // Don't request if user skipped
    
    let cancelled = false;

    const requestLocation = async () => {
      if (!navigator.geolocation) {
        setLocationStatus("error");
        setLocationError("Geolocation is not supported by your browser.");
        return;
      }

      setLocationStatus("requesting");

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          if (cancelled) return;
          
          try {
            await fetch(`/api/v1/location/update`, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
              }),
            });
            setLocationStatus("granted");
            
            // ✅ Fetch buses AFTER location is sent
            const res = await fetchBuses();
            if (!cancelled) setBuses(res.data);
          } catch (err) {
            console.error("Failed to send location:", err);
            setLocationStatus("error");
            setLocationError("Failed to update location. Please try again.");
          }
        },
        (err) => {
          if (cancelled) return;
          
          console.error("Geolocation error:", err);
          setLocationStatus("denied");
          
          switch (err.code) {
            case err.PERMISSION_DENIED:
              setLocationError("Location access was denied.");
              break;
            case err.POSITION_UNAVAILABLE:
              setLocationError("Location information unavailable.");
              break;
            case err.TIMEOUT:
              setLocationError("Location request timed out.");
              break;
            default:
              setLocationError("Unable to retrieve your location.");
          }
        },
        { 
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    };

    requestLocation();

    return () => { cancelled = true; };
  }, [isLocationSkipped]);

  // 🔄 Retry location permission
  const handleRetryLocation = () => {
    setLocationStatus("idle");
    setLocationError("");
    setIsLocationSkipped(false);
    // Re-trigger effect by updating state
    setLocationStatus("requesting");
  };

  // ⏭️ Skip location and load buses anyway
  const handleSkipLocation = async () => {
    setIsLocationSkipped(true);
    setLocationStatus("skipped");
    
    // Still fetch buses so user can use core features
    try {
      const res = await fetchBuses();
      setBuses(res.data);
    } catch (err) {
      console.error("Failed to fetch buses:", err);
    }
  };

  // 🚫 Render blocking UI while requesting (but not if skipped)
  if (locationStatus === "requesting") {
    return (
      <div className="w-full max-w-6xl h-full flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <p className="text-muted-foreground">Requesting location access...</p>
        <p className="text-xs text-muted-foreground/70">
          Please allow location access in the browser prompt
        </p>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleSkipLocation}
          className="mt-2"
        >
          Skip for now
        </Button>
      </div>
    );
  }

  if (locationStatus === "denied" || locationStatus === "error") {
    return (
      <div className="w-full max-w-6xl h-full flex flex-col items-center justify-center gap-6 p-6">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-destructive">
            Location Access Required
          </h2>
          <p className="text-muted-foreground max-w-md">
            {locationError}
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={handleRetryLocation}>
            Retry
          </Button>
          <Button 
            variant="outline" 
            onClick={handleSkipLocation}
          >
            Skip for now
          </Button>
          <Button variant="ghost" asChild>
            <a 
              href="https://www.google.com/search?q=how+to+enable+location+in+browser"
              target="_blank"
              rel="noopener noreferrer"
            >
              Help: Enable Location
            </a>
          </Button>
        </div>
        
        <details className="text-xs text-muted-foreground mt-4">
          <summary className="cursor-pointer">Why do we need your location?</summary>
          <p className="mt-2 max-w-md">
            We use your location to:
            • Show nearby buses on the map
            • Send you relevant tracking requests
            • Improve route accuracy
          </p>
        </details>
      </div>
    );
  }

  // ✅ Main content - renders after location granted OR skipped
  if (locationStatus !== "granted" && locationStatus !== "skipped") {
    return null; // Fallback
  }

  return (
    <div className="w-full max-w-6xl h-full flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Live Bus Tracking</h1>
        
        {/* Show location status indicator */}
        {locationStatus === "skipped" && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              setIsLocationSkipped(false);
              setLocationStatus("idle");
              // Re-trigger location request
              setLocationStatus("requesting");
            }}
            className="text-xs"
          >
            Enable Location
          </Button>
        )}
      </div>

      {/* Show warning banner if location skipped */}
      {locationStatus === "skipped" && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md text-sm text-amber-800 dark:text-amber-200">
          <span className="font-medium">Location disabled:</span> Some features like nearby bus detection may not work accurately.{" "}
          <button 
            onClick={() => {
              setIsLocationSkipped(false);
              setLocationStatus("idle");
              setLocationStatus("requesting");
            }}
            className="underline hover:no-underline font-medium"
          >
            Enable now
          </button>
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        {buses?.map((bus) => (
          <Button 
            key={bus.id} 
            onClick={() => {
              setPoints([]);
              handleRequestTracking(bus.id);
            }}
          >
            Track Bus {bus.busNumber}
          </Button>
        ))}
      </div>

      <div className="h-full min-h-[400px]">
        <BusMap points={points} />
      </div>
    </div>
  );

  // ─────────────────────────────────────────
  // Helper function (kept inside component for closure access)
  async function handleRequestTracking(busId: number) {
    try {
      const res = await fetch(`/api/v1/tracking/request/${busId}`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to request tracking");

      const data = await res.json();
      setPoints(data.points || []);
      console.log("Tracking requested:", data);
    } catch (error) {
      console.error("Error requesting tracking:", error);
    }
  }
}