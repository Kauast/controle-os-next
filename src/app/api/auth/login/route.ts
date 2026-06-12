import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:3333";
const IS_PROD = process.env.NODE_ENV === "production";

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

  const cookieBase = {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "strict" as const,
    path: "/",
  };

  // accessToken em cookie httpOnly — não acessível por JS
  response.cookies.set("auth_token", data.accessToken, {
    ...cookieBase,
    maxAge: 60 * 60 * 8, // 8h (mesma expiração do JWT)
  });

  // refreshToken em cookie httpOnly separado — usado apenas para rotação
  if (data.refreshToken) {
    response.cookies.set("refresh_token", data.refreshToken, {
      ...cookieBase,
      maxAge: 60 * 60 * 24 * 7, // 7 dias
    });
  }

  return response;
}
