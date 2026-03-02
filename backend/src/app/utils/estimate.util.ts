export function timeToMinutes(t: string) {
  const [hh, mm] = t.split(":").map(Number);
  return hh * 60 + mm;
}

export function interpolate(
  p1: { lat: number; lng: number },
  p2: { lat: number; lng: number },
  ratio: number
) {
  return {
    lat: p1.lat + (p2.lat - p1.lat) * ratio,
    lng: p1.lng + (p2.lng - p1.lng) * ratio,
  };
}

// ── Haversine (inline to avoid circular dep) ──────────────────────────────────
function hav(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Minimum distance (metres) from point (lat, lng) to the nearest point
 * on any segment of the given polyline.
 *
 * Uses a flat-earth approximation for the projection parameter `t`
 * (accurate to < 0.01% error for segments < 50 km long).
 */
export function pointToPolylineDistance(
  lat: number,
  lng: number,
  points: { lat: number; lng: number }[]
): number {
  if (points.length === 0) return Infinity;
  if (points.length === 1) return hav(lat, lng, points[0].lat, points[0].lng);

  let minDist = Infinity;

  for (let i = 0; i < points.length - 1; i++) {
    const aLat = points[i].lat;
    const aLng = points[i].lng;
    const bLat = points[i + 1].lat;
    const bLng = points[i + 1].lng;

    const dx = bLng - aLng;
    const dy = bLat - aLat;
    const lenSq = dx * dx + dy * dy;

    let t = 0;
    if (lenSq > 0) {
      t = ((lng - aLng) * dx + (lat - aLat) * dy) / lenSq;
      t = Math.min(1, Math.max(0, t));
    }

    const closestLat = aLat + t * dy;
    const closestLng = aLng + t * dx;
    const d = hav(lat, lng, closestLat, closestLng);
    if (d < minDist) minDist = d;
  }

  return minDist;
}
