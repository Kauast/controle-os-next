import axios, { type AxiosRequestConfig } from "axios";

// Em dev e produção, usa o proxy Next.js que adiciona o token automaticamente
const BASE = "/api/backend";

export const apiClient = axios.create({
  baseURL: BASE,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

// ---------------------------------------------------------------------------
// Interceptor de request: injeta CSRF token em métodos mutáveis
// ---------------------------------------------------------------------------

/** Lê o cookie `csrf_token` do documento (não é httpOnly). */
function getCsrfCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith("csrf_token="));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

const MUTABLE_METHODS = new Set(["post", "put", "patch", "delete"]);

apiClient.interceptors.request.use((config) => {
  const method = (config.method ?? "").toLowerCase();
  if (MUTABLE_METHODS.has(method)) {
    const csrf = getCsrfCookie();
    if (csrf) {
      config.headers["x-csrf-token"] = csrf;
    }
  }
  return config;
});

// ---------------------------------------------------------------------------
// Interceptor de response: refresh token automático com coalescing de 401s
// ---------------------------------------------------------------------------

/**
 * Promise compartilhada de refresh em andamento.
 * Garante que múltiplos 401 concorrentes disparem apenas UMA chamada de refresh,
 * e todos aguardam o mesmo resultado antes de fazer retry.
 */
let _refreshPromise: Promise<"ok" | "auth_failed" | "transient"> | null = null;

/**
 * Chama a rota Next de refresh (server-side, não expõe tokens ao JS).
 * - 'ok'          → refresh bem-sucedido, pode retentar a request original
 * - 'auth_failed' → 401/403 do endpoint de refresh (token inválido/expirado)
 * - 'transient'   → 5xx, 429 ou falha de rede (outage temporário, não forçar logout)
 */
async function doRefresh(): Promise<"ok" | "auth_failed" | "transient"> {
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      // Inclui cookies httpOnly automaticamente (same-origin)
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (res.ok) return "ok";
    if (res.status === 401 || res.status === 403) return "auth_failed";
    return "transient";
  } catch {
    // Falha de rede ou timeout — erro transiente, não deve forçar logout
    return "transient";
  }
}

/** Tipo interno para marcar config de retry e evitar loop infinito */
type RetryableConfig = AxiosRequestConfig & { _retry?: boolean };

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config as RetryableConfig | undefined;

    // Só tenta refresh se for 401, se tiver config e não for já um retry
    if (
      error.response?.status !== 401 ||
      !config ||
      config._retry
    ) {
      // 401 num retry ou sem config: redireciona para login
      if (error.response?.status === 401 && typeof window !== "undefined") {
        window.location.href = "/login";
      }
      return Promise.reject(error);
    }

    // Marca como retry para não entrar em loop
    config._retry = true;

    // Coalescing: se já há um refresh em andamento, aguarda o mesmo
    if (!_refreshPromise) {
      _refreshPromise = doRefresh().finally(() => {
        _refreshPromise = null;
      });
    }

    const refreshResult = await _refreshPromise;

    if (refreshResult === "auth_failed") {
      // Token inválido ou expirado — sessão encerrada, redireciona para login
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      return Promise.reject(error);
    }

    if (refreshResult === "transient") {
      // Erro temporário (5xx, 429, rede) — não forçar logout, propaga o erro
      return Promise.reject(error);
    }

    // Refresh bem-sucedido: repete a request original
    // O novo auth_token já está no cookie httpOnly; o proxy o lê automaticamente
    return apiClient(config);
  }
);
