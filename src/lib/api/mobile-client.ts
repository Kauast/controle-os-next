import axios from "axios";

const FASTIFY_URL = process.env.NEXT_PUBLIC_FASTIFY_URL ?? "http://localhost:3333";

export const mobileApiClient = axios.create({
  baseURL: `${FASTIFY_URL}/api`,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

mobileApiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("mobile_auth_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

mobileApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("mobile_auth_token");
      window.location.href = "/tecnico-mobile/login/";
    }
    return Promise.reject(error);
  }
);

export function getMobileToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("mobile_auth_token");
}

export function setMobileToken(token: string): void {
  localStorage.setItem("mobile_auth_token", token);
}

export function clearMobileToken(): void {
  localStorage.removeItem("mobile_auth_token");
}
