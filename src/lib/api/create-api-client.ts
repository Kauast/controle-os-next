import axios, { type AxiosInstance, type AxiosRequestConfig, type InternalAxiosRequestConfig } from "axios";

export type RefreshResult = "ok" | "auth_failed" | "transient";

export interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
  /** Called on every request — inject headers (CSRF, Authorization). */
  beforeRequest?: (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig;
  /**
   * Execute token refresh.
   * - 'ok'          → success, retry original request
   * - 'auth_failed' → invalid/expired token → call onAuthFailed
   * - 'transient'   → temporary failure (5xx, network) → propagate error without logout
   */
  doRefresh: () => Promise<RefreshResult>;
  /**
   * Called after a successful refresh to inject the new Authorization header
   * into the retried request. Not needed for web (cookies are automatic).
   */
  getAuthHeader?: () => string | null;
  /** Called on auth_failed — must redirect to login and clear tokens. */
  onAuthFailed: () => Promise<void>;
}

type RetryableConfig = AxiosRequestConfig & { _retry?: boolean };

/**
 * Creates an Axios instance with automatic token refresh and 401 coalescing.
 * Multiple concurrent 401s trigger a single refresh call.
 */
export function createApiClient(config: ApiClientConfig): AxiosInstance {
  const instance = axios.create({
    baseURL: config.baseURL,
    headers: { "Content-Type": "application/json" },
    timeout: config.timeout ?? 15000,
  });

  if (config.beforeRequest) {
    instance.interceptors.request.use(config.beforeRequest);
  }

  let _refreshPromise: Promise<RefreshResult> | null = null;

  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const cfg = error.config as RetryableConfig | undefined;

      if (error.response?.status !== 401 || !cfg || cfg._retry) {
        if (error.response?.status === 401) {
          await config.onAuthFailed();
        }
        return Promise.reject(error);
      }

      cfg._retry = true;

      if (!_refreshPromise) {
        _refreshPromise = config.doRefresh().finally(() => {
          _refreshPromise = null;
        });
      }

      const result = await _refreshPromise;

      if (result === "auth_failed") {
        await config.onAuthFailed();
        return Promise.reject(error);
      }

      if (result === "transient") {
        return Promise.reject(error);
      }

      if (config.getAuthHeader) {
        const header = config.getAuthHeader();
        if (header) cfg.headers = { ...cfg.headers, Authorization: header };
      }

      return instance(cfg);
    }
  );

  return instance;
}
