import { Capacitor } from "@capacitor/core";

export function isCapacitorApp(): boolean {
  if (typeof window === "undefined") return false;
  return Capacitor.isNativePlatform();
}

/** URL base do backend Fastify, usada apenas no contexto mobile/Capacitor. */
export function getMobileApiBase(): string {
  return (process.env.NEXT_PUBLIC_FASTIFY_URL ?? "http://localhost:3333") + "/api";
}

/**
 * Web usa o proxy Next.js (/api/backend).
 * Mobile/Capacitor usa o backend Fastify diretamente.
 */
export function getApiBaseUrl(): string {
  if (isCapacitorApp()) return getMobileApiBase();
  return "/api/backend";
}
