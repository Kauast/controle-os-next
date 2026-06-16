import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { IS_PROD } from "@/lib/api/backend-config";

/**
 * GET /api/auth/csrf
 *
 * Gera um token CSRF aleatorio, persiste em cookie csrf_token
 * (httpOnly: false para ser lido pelo JS — padrao Double Submit Cookie)
 * e retorna { csrfToken } no body.
 *
 * O cliente deve:
 *   1. Chamar este endpoint antes da primeira mutacao.
 *   2. Incluir o valor no header x-csrf-token em POST/PUT/PATCH/DELETE.
 */
export async function GET() {
  const csrfToken = randomBytes(32).toString("hex");

  const response = NextResponse.json({ csrfToken });

  response.cookies.set("csrf_token", csrfToken, {
    httpOnly: false,
    secure: IS_PROD,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return response;
}
