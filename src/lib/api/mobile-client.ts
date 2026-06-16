import { createApiClient } from "./create-api-client";
import {
  getToken,
  setToken,
  clearToken,
  getRefreshToken,
  setRefreshToken,
  clearRefreshToken,
} from "@/lib/mobile/storage";

const FASTIFY_URL = process.env.NEXT_PUBLIC_FASTIFY_URL ?? "http://localhost:3333";

let _token: string | null = null;
let _refreshToken: string | null = null;

async function doMobileRefresh() {
  const storedRefresh = _refreshToken ?? (await getRefreshToken());
  if (!storedRefresh) return "auth_failed" as const;

  try {
    const res = await fetch("/api/auth/mobile-refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: storedRefresh }),
    });

    if (!res.ok) return "auth_failed" as const;

    const data = (await res.json()) as { accessToken?: string; refreshToken?: string };
    if (!data.accessToken) return "auth_failed" as const;

    _token = data.accessToken;
    await setToken(data.accessToken);

    if (data.refreshToken) {
      _refreshToken = data.refreshToken;
      await setRefreshToken(data.refreshToken);
    }

    return "ok" as const;
  } catch {
    return "transient" as const;
  }
}

async function onMobileAuthFailed() {
  await clearToken();
  await clearRefreshToken();
  _token = null;
  _refreshToken = null;
  if (typeof window !== "undefined") {
    window.location.href = "/tecnico-mobile/login/";
  }
}

export const mobileApiClient = createApiClient({
  baseURL: `${FASTIFY_URL}/api`,
  beforeRequest: (config) => {
    if (_token) config.headers.Authorization = `Bearer ${_token}`;
    return config;
  },
  doRefresh: doMobileRefresh,
  getAuthHeader: () => (_token ? `Bearer ${_token}` : null),
  onAuthFailed: onMobileAuthFailed,
});

export async function initMobileAuth(): Promise<string | null> {
  _token = await getToken();
  _refreshToken = await getRefreshToken();
  return _token;
}

export async function storeMobileTokens(accessToken: string, refreshToken?: string): Promise<void> {
  _token = accessToken;
  await setToken(accessToken);
  if (refreshToken) {
    _refreshToken = refreshToken;
    await setRefreshToken(refreshToken);
  }
}

export async function removeMobileTokens(): Promise<void> {
  await clearToken();
  await clearRefreshToken();
  _token = null;
  _refreshToken = null;
}

export function getMobileToken(): string | null {
  return _token;
}

/** @deprecated Use storeMobileTokens */
export async function storeMobileToken(token: string): Promise<void> {
  return storeMobileTokens(token);
}

/** @deprecated Use removeMobileTokens */
export async function removeMobileToken(): Promise<void> {
  return removeMobileTokens();
}

/** @deprecated Use storeMobileTokens (async) */
export function setMobileToken(token: string): void {
  _token = token;
  void setToken(token);
}

/** @deprecated Use removeMobileTokens (async) */
export function clearMobileToken(): void {
  _token = null;
  void clearToken();
}
