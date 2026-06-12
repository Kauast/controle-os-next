import { getClientPlatform, isCapacitorApp } from "@/lib/platform/capacitor";

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_WEB_BASE_URL = "/api/backend";

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function getBackendOrigin() {
  const envUrl =
    process.env.NEXT_PUBLIC_MOBILE_BACKEND_URL ??
    process.env.NEXT_PUBLIC_FASTIFY_URL ??
    process.env.NEXT_PUBLIC_BACKEND_URL;

  if (!envUrl) {
    return "";
  }

  return stripTrailingSlash(envUrl);
}

export function getApiBaseUrl() {
  if (!isCapacitorApp()) {
    return DEFAULT_WEB_BASE_URL;
  }

  const backendOrigin = getBackendOrigin();
  if (!backendOrigin) {
    throw new Error(
      "NEXT_PUBLIC_MOBILE_BACKEND_URL nao configurada para o app Capacitor.",
    );
  }

  return `${backendOrigin}/api`;
}

export function getApiTimeoutMs() {
  const parsed = Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

export function getAuthRedirectPath() {
  if (!isCapacitorApp()) {
    return typeof window !== "undefined" && window.location.pathname.startsWith("/tecnico")
      ? "/tecnico/login"
      : "/login";
  }

  return "/tecnico/login";
}

export function getClientHeaders() {
  return {
    "X-Client-Platform": getClientPlatform(),
  };
}
