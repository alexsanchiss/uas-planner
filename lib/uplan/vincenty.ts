import LatLon from "geodesy/latlon-ellipsoidal-vincenty.js";

export function vincentyDistAzimuth(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const p1 = new LatLon(lat1, lon1);
  const p2 = new LatLon(lat2, lon2);
  const distance = p1.distanceTo(p2); // metros
  const azimuth = p1.initialBearingTo(p2); // grados
  return { distance, azimuth };
}

export function vincentyReckon(
  lat1: number,
  lon1: number,
  distance: number,
  azimuth: number
) {
  const p1 = new LatLon(lat1, lon1);
  const dest = p1.destinationPoint(distance, azimuth);
  return { lat: dest.lat, lon: dest.lon };
}
