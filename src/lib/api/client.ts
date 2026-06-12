import axios, { type InternalAxiosRequestConfig } from "axios";
import {
  getApiBaseUrl,
  getApiTimeoutMs,
  getAuthRedirectPath,
  getBackendOrigin,
  getClientHeaders,
} from "@/lib/api/config";
import { normalizeApiError } from "@/lib/api/errors";
import {
  clearMobileSession,
  getMobileAccessToken,
  getMobileRefreshToken,
  persistMobileSession,
} from "@/lib/auth/mobile-session";
import { isCapacitorApp } from "@/lib/platform/capacitor";

type RetriableConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

const refreshClient = axios.create({
  timeout: getApiTimeoutMs(),
  headers: { "Content-Type": "application/json" },
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshMobileAccessToken() {
  if (!isCapacitorApp()) {
    return null;
  }

  const refreshToken = await getMobileRefreshToken();
  if (!refreshToken) {
    return null;
  }

  try {
    const { data } = await refreshClient.post<{
      accessToken: string;
      refreshToken?: string;
      user?: { id: string; email: string; role: string; name?: string };
    }>(`${getBackendOrigin()}/api/auth/refresh`, { refreshToken });

    await persistMobileSession({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken ?? refreshToken,
      user: data.user ?? null,
    });

    return data.accessToken;
  } catch {
    await clearMobileSession();
    return null;
  }
}

async function getRefreshPromise() {
  if (!refreshPromise) {
    refreshPromise = refreshMobileAccessToken().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  headers: { "Content-Type": "application/json", ...getClientHeaders() },
  timeout: getApiTimeoutMs(),
  withCredentials: !isCapacitorApp(),
});

apiClient.interceptors.request.use(async (config) => {
  config.baseURL = getApiBaseUrl();
  config.timeout = getApiTimeoutMs();
  config.headers.set("X-Client-Platform", getClientHeaders()["X-Client-Platform"]);

  if (isCapacitorApp()) {
    const token = await getMobileAccessToken();
    if (token) {
      config.headers.set("Authorization", `Bearer ${token}`);
    }
  }

  if (config.data instanceof FormData) {
    config.headers.delete("Content-Type");
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const normalized = normalizeApiError(error);
    const requestConfig = error.config as RetriableConfig | undefined;

    if (error.response?.status === 401 && requestConfig && isCapacitorApp() && !requestConfig._retry) {
      requestConfig._retry = true;
      const nextAccessToken = await getRefreshPromise();

      if (nextAccessToken) {
        requestConfig.headers.set("Authorization", `Bearer ${nextAccessToken}`);
        return apiClient(requestConfig);
      }
    }

    if (error.response?.status === 401) {
      if (isCapacitorApp()) {
        await clearMobileSession();
      }

      if (typeof window !== "undefined") {
        window.location.href = getAuthRedirectPath();
      }
    }

    return Promise.reject(normalized);
  },
);
