import { createApiClient } from "./create-api-client";

const MUTABLE_METHODS = new Set(["post", "put", "patch", "delete"]);

function getCsrfCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith("csrf_token="));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

async function doWebRefresh() {
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (res.ok) return "ok" as const;
    if (res.status === 401 || res.status === 403) return "auth_failed" as const;
    return "transient" as const;
  } catch {
    return "transient" as const;
  }
}

export const apiClient = createApiClient({
  baseURL: "/api/backend",
  beforeRequest: (config) => {
    const method = (config.method ?? "").toLowerCase();
    if (MUTABLE_METHODS.has(method)) {
      const csrf = getCsrfCookie();
      if (csrf) config.headers["x-csrf-token"] = csrf;
    }
    return config;
  },
  doRefresh: doWebRefresh,
  onAuthFailed: async () => {
    if (typeof window !== "undefined") window.location.href = "/login";
  },
});
