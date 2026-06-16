import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL, COOKIE_BASE } from "@/lib/api/backend-config";

const BACKEND = BACKEND_URL;

export async function POST(request: NextRequest) {
  const body = await request.json();

  const res = await fetch(`${BACKEND}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }

  const response = NextResponse.json({ user: data.user });

  // accessToken em cookie httpOnly — não acessível por JS
  response.cookies.set("auth_token", data.accessToken, {
    ...COOKIE_BASE,
    maxAge: 60 * 60 * 8, // 8h (mesma expiração do JWT)
  });

  // refreshToken em cookie httpOnly separado — usado apenas para rotação
  if (data.refreshToken) {
    response.cookies.set("refresh_token", data.refreshToken, {
      ...COOKIE_BASE,
      maxAge: 60 * 60 * 24 * 7, // 7 dias
    });
  }

  return response;
}
