/**
 * Configuração compartilhada das API routes Next.js que fazem proxy para o backend Fastify.
 * Centraliza a URL do backend e as opções de cookie comuns.
 */

export const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3333";

export const IS_PROD = process.env.NODE_ENV === "production";

export const COOKIE_BASE = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: "strict" as const,
  path: "/",
} as const;
