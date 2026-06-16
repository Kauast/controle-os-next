import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/api/backend-config";

const IS_PROD = process.env.NODE_ENV === "production";

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get("refresh_token")?.value;
  if (!refreshToken) {
    return NextResponse.json({ error: "Sessao expirada." }, { status: 401 });
  }

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    return NextResponse.json({ error: "Servico indisponivel." }, { status: 503 });
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }

  const response = NextResponse.json({
    ok: true,
    user: (data as { user?: unknown }).user,
  });

  const cookieBase = {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "strict" as const,
    path: "/",
  };

  const accessToken = (data as { accessToken?: string }).accessToken;
  const nextRefreshToken = (data as { refreshToken?: string }).refreshToken;

  if (accessToken) {
    response.cookies.set("auth_token", accessToken, {
      ...cookieBase,
      maxAge: 60 * 60 * 8,
    });
  }

  if (nextRefreshToken) {
    response.cookies.set("refresh_token", nextRefreshToken, {
      ...cookieBase,
      maxAge: 60 * 60 * 24 * 7,
    });
  }

  return response;
}
