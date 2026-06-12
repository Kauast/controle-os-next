import axios from "axios";
import { backendRoleToFrontend, type AuthUser } from "@/lib/auth";
import { getApiBaseUrl, getBackendOrigin, getAuthRedirectPath } from "@/lib/api/config";
import { normalizeApiError } from "@/lib/api/errors";
import { apiClient } from "@/lib/api/client";
import {
  clearMobileSession,
  getMobileRefreshToken,
  persistMobileSession,
} from "@/lib/auth/mobile-session";
import { isCapacitorApp } from "@/lib/platform/capacitor";

export interface SessionProfile extends AuthUser {
  technician?: {
    id: string;
    name: string;
    team: string;
    phone?: string;
  } | null;
}

interface LoginResponse {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number;
  user: SessionProfile;
}

const authClient = axios.create({
  timeout: 20_000,
  headers: { "Content-Type": "application/json" },
});

export async function loginWithPassword(email: string, password: string) {
  if (!isCapacitorApp()) {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      user?: SessionProfile;
    };

    if (!response.ok) {
      throw normalizeApiError(new Error(data.error ?? data.message ?? "Falha no login."));
    }

    return data.user ?? null;
  }

  const response = await authClient.post<LoginResponse>(`${getApiBaseUrl()}/auth/login`, {
    email,
    password,
  });

  await persistMobileSession({
    accessToken: response.data.accessToken,
    refreshToken: response.data.refreshToken,
    user: response.data.user,
  });

  return response.data.user;
}

export async function logoutSession() {
  if (!isCapacitorApp()) {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    return;
  }

  const refreshToken = await getMobileRefreshToken();
  if (refreshToken) {
    await authClient
      .post(`${getBackendOrigin()}/api/auth/logout`, { refreshToken })
      .catch(() => undefined);
  }

  await clearMobileSession();
}

export async function fetchCurrentSessionProfile() {
  const { data } = await apiClient.get<SessionProfile>("/auth/me");
  return data;
}

export function toAuthStoreUser(user: SessionProfile): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

export function getFrontendRole(role: string) {
  return backendRoleToFrontend(role);
}

export function redirectToLogin() {
  if (typeof window === "undefined") {
    return;
  }

  window.location.href = getAuthRedirectPath();
}
