import axios from "axios";
import { getToken, setToken, clearToken } from "@/lib/mobile/storage";

const FASTIFY_URL = process.env.NEXT_PUBLIC_FASTIFY_URL ?? "http://localhost:3333";

export const mobileApiClient = axios.create({
  baseURL: `${FASTIFY_URL}/api`,
  headers: { "Content-Type": "application/json" },
  timeout: 20000,
});

// Cache em memória para manter o interceptor síncrono
let _token: string | null = null;

/** Deve ser chamado no mount do layout mobile para carregar o token do storage. */
export async function initMobileAuth(): Promise<string | null> {
  _token = await getToken();
  return _token;
}

mobileApiClient.interceptors.request.use((config) => {
  if (_token) config.headers.Authorization = `Bearer ${_token}`;
  return config;
});

mobileApiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      await clearToken();
      _token = null;
      if (typeof window !== "undefined") {
        window.location.href = "/tecnico-mobile/login/";
      }
    }
    return Promise.reject(error);
  }
);

export async function storeMobileToken(token: string): Promise<void> {
  await setToken(token);
  _token = token;
}

export async function removeMobileToken(): Promise<void> {
  await clearToken();
  _token = null;
}

/** Retorna o token do cache em memória (síncrono, pós-init). */
export function getMobileToken(): string | null {
  // Fallback para localStorage no navegador enquanto initMobileAuth não rodou
  if (_token) return _token;
  if (typeof window !== "undefined") return localStorage.getItem("mobile_auth_token");
  return null;
}

/** @deprecated Use storeMobileToken (async). Mantido para compatibilidade. */
export function setMobileToken(token: string): void {
  _token = token;
  void setToken(token);
}

/** @deprecated Use removeMobileToken (async). Mantido para compatibilidade. */
export function clearMobileToken(): void {
  _token = null;
  void clearToken();
}
