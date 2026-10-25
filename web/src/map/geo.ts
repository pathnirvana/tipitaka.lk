/** small geography helpers (no map code: used outside the lazy map chunk too) */

/** distance in km (equirectangular: exact enough at these distances) */
export function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = Math.PI / 180
  const x = (b.lon - a.lon) * r * Math.cos(((a.lat + b.lat) / 2) * r), y = (b.lat - a.lat) * r
  return Math.sqrt(x * x + y * y) * 6371
}

/** 1 yojana ≈ 12 km (estimates range from 11 to 15 km) */
export const YOJANA_KM = 12
