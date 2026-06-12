import { Capacitor } from "@capacitor/core";

export interface GeoResult {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

async function capacitorGeo(): Promise<GeoResult> {
  const { Geolocation } = await import("@capacitor/geolocation");
  await Geolocation.requestPermissions();
  const pos = await Geolocation.getCurrentPosition({
    enableHighAccuracy: true,
    timeout: 15000,
  });
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
    timestamp: pos.timestamp,
  };
}

function webGeo(): Promise<GeoResult> {
  return new Promise((resolve, reject) => {
    if (!navigator?.geolocation) {
      reject(new Error("Geolocalização não disponível neste dispositivo"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  });
}

export async function getCurrentLocation(): Promise<GeoResult | null> {
  try {
    if (Capacitor.isNativePlatform()) return await capacitorGeo();
    return await webGeo();
  } catch {
    return null;
  }
}

export function buildMapsUrl(address?: string | null, lat?: number | null, lng?: number | null): string {
  if (lat != null && lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  if (address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }
  return "https://www.google.com/maps";
}
