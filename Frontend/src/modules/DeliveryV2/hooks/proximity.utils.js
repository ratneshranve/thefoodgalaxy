/**
 * Haversine formula to calculate the great-circle distance between two points on a sphere.
 * Returns distance in METERS.
 */
export const parseLatLng = (raw) => {
  if (!raw) return null;

  let lat = Number(raw.lat ?? raw.latitude);
  let lng = Number(raw.lng ?? raw.longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    const coords = raw.coordinates || raw.location?.coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      lng = Number(coords[0]);
      lat = Number(coords[1]);
    }
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const aLat = Number(lat1);
  const aLng = Number(lon1);
  const bLat = Number(lat2);
  const bLng = Number(lon2);

  if (!Number.isFinite(aLat) || !Number.isFinite(aLng) || !Number.isFinite(bLat) || !Number.isFinite(bLng)) {
    return Infinity;
  }

  const R = 6371e3;
  const φ1 = (aLat * Math.PI) / 180;
  const φ2 = (bLat * Math.PI) / 180;
  const Δφ = ((bLat - aLat) * Math.PI) / 180;
  const Δλ = ((bLng - aLng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};
