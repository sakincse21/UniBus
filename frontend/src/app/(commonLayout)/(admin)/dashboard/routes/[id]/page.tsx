/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { toast } from "sonner";
import {
  fetchRouteById,
  setRoutePoints,
  updateRoute,
} from "@/lib/action/route";
import {
  Map,
  MapMarker,
  MarkerContent,
  MarkerTooltip,
} from "@/components/ui/map";
import type MapLibreGL from "maplibre-gl";

type RoutePoint = {
  id?: number;
  lat: number;
  lng: number;
  sequence: number;
  minuteOffset: number;
};

export default function RoutePointsEditorPage() {
  const params = useParams();
  const router = useRouter();
  const routeId = Number(params.id);

  const [routeName, setRouteName] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [points, setPoints] = useState<RoutePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const mapRef = useRef<MapLibreGL.Map | null>(null);
  const pointsRef = useRef<RoutePoint[]>([]);

  // Keep a ref in sync with points state for the map click handler
  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  const loadRoute = useCallback(async () => {
    const res = await fetchRouteById(routeId);
    if (res.success) {
      setRouteName(res.data.name);
      setOriginalName(res.data.name);
      setPoints(
        (res.data.points || []).map((p: any) => ({
          id: p.id,
          lat: p.lat,
          lng: p.lng,
          sequence: p.sequence,
          minuteOffset: p.minuteOffset,
        }))
      );
    }
  }, [routeId]);

  useEffect(() => {
    let ignore = false;
    fetchRouteById(routeId).then((res) => {
      if (ignore) return;
      if (res.success) {
        setRouteName(res.data.name);
        setOriginalName(res.data.name);
        setPoints(
          (res.data.points || []).map((p: any) => ({
            id: p.id,
            lat: p.lat,
            lng: p.lng,
            sequence: p.sequence,
            minuteOffset: p.minuteOffset,
          }))
        );
      }
    });
    return () => { ignore = true; };
  }, [routeId]);

  // Attach click listener to the map instance via ref
  const handleMapClickInternal = useCallback((e: any) => {
    const { lng, lat } = e.lngLat;
    const currentPoints = pointsRef.current;
    const newSequence = currentPoints.length + 1;
    const lastOffset =
      currentPoints.length > 0 ? currentPoints[currentPoints.length - 1].minuteOffset : 0;

    setPoints((prev) => [
      ...prev,
      {
        lat,
        lng,
        sequence: newSequence,
        minuteOffset: lastOffset + 5,
      },
    ]);

    toast.info(`Point #${newSequence} added at ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
  }, []);

  const handleMapRef = useCallback((map: MapLibreGL.Map | null) => {
    if (mapRef.current) {
      mapRef.current.off("click", handleMapClickInternal);
    }
    mapRef.current = map;
    if (map) {
      map.on("click", handleMapClickInternal);
    }
  }, [handleMapClickInternal]);

  const handleSavePoints = async () => {
    if (points.length === 0) return toast.error("Add at least one point");
    setLoading(true);

    // Save route name if changed
    if (routeName !== originalName) {
      await updateRoute(routeId, routeName);
    }

    const res = await setRoutePoints(
      routeId,
      points.map((p) => ({
        lat: p.lat,
        lng: p.lng,
        sequence: p.sequence,
        minuteOffset: p.minuteOffset,
      }))
    );
    setLoading(false);

    if (res.success) {
      toast.success("Route points saved!");
      loadRoute();
    } else {
      toast.error(res.message || "Failed to save points");
    }
  };

  const handleRemovePoint = (idx: number) => {
    setPoints((prev) => {
      const updated = prev.filter((_, i) => i !== idx);
      // Resequence
      return updated.map((p, i) => ({ ...p, sequence: i + 1 }));
    });
  };

  const handlePointFieldChange = (
    idx: number,
    field: keyof RoutePoint,
    value: number
  ) => {
    setPoints((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p))
    );
  };

  const movePoint = (idx: number, direction: "up" | "down") => {
    if (
      (direction === "up" && idx === 0) ||
      (direction === "down" && idx === points.length - 1)
    ) {
      return;
    }

    const newPoints = [...points];
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    [newPoints[idx], newPoints[swapIdx]] = [newPoints[swapIdx], newPoints[idx]];

    // Resequence
    setPoints(newPoints.map((p, i) => ({ ...p, sequence: i + 1 })));
  };

  return (
    <div className="w-full max-w-6xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.push("/dashboard/routes")}>
          ← Back
        </Button>
        <div className="flex-1">
          <Input
            value={routeName}
            onChange={(e) => setRouteName(e.target.value)}
            className="text-lg font-semibold"
            placeholder="Route name"
          />
        </div>
      </div>

      {/* Map for adding points by clicking */}
      <Card>
        <CardHeader>
          <CardTitle>Route Points Map</CardTitle>
          <CardDescription>
            Click on the map to add route points. Points will be connected in
            sequence order. Drag to pan, scroll to zoom.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full h-[400px] rounded border">
            <Map
              ref={handleMapRef}
              center={[89.5, 22.9]}
              zoom={12}
            >
              {points.map((point, idx) => (
                <MapMarker
                  key={`${point.sequence}-${point.lat}-${point.lng}`}
                  latitude={point.lat}
                  longitude={point.lng}
                >
                  <MarkerContent>
                    <div
                      className={`size-6 rounded-full bg-blue-600 shadow-lg flex items-center justify-center text-white text-xs font-bold cursor-pointer ${
                        editingIdx === idx ? "ring-2 ring-yellow-400" : ""
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingIdx(editingIdx === idx ? null : idx);
                      }}
                    >
                      {point.sequence}
                    </div>
                  </MarkerContent>
                  <MarkerTooltip>
                    Point #{point.sequence} — {point.minuteOffset}min offset
                  </MarkerTooltip>
                </MapMarker>
              ))}
            </Map>
          </div>
        </CardContent>
      </Card>

      {/* Points Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Route Points ({points.length})</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setPoints([])}
                disabled={points.length === 0}
              >
                Clear All
              </Button>
              <Button onClick={handleSavePoints} disabled={loading}>
                {loading ? "Saving..." : "Save All Points"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {points.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No points yet. Click on the map to add route points.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Latitude</TableHead>
                  <TableHead>Longitude</TableHead>
                  <TableHead>Minute Offset</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {points.map((point, idx) => (
                  <TableRow
                    key={idx}
                    className={editingIdx === idx ? "bg-muted/50" : ""}
                  >
                    <TableCell className="font-medium">
                      {point.sequence}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.00001"
                        value={point.lat}
                        onChange={(e) =>
                          handlePointFieldChange(
                            idx,
                            "lat",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-32"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.00001"
                        value={point.lng}
                        onChange={(e) =>
                          handlePointFieldChange(
                            idx,
                            "lng",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-32"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={point.minuteOffset}
                        onChange={(e) =>
                          handlePointFieldChange(
                            idx,
                            "minuteOffset",
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => movePoint(idx, "up")}
                        disabled={idx === 0}
                      >
                        ↑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => movePoint(idx, "down")}
                        disabled={idx === points.length - 1}
                      >
                        ↓
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemovePoint(idx)}
                      >
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
