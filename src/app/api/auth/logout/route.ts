import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:3333";
const IS_PROD = process.env.NODE_ENV === "production";

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get("refresh_token")?.value;

  // revoga o refreshToken no backend (melhor esforço — não bloqueia o logout)
  if (refreshToken) {
    try {
      await fetch(`${BACKEND}/api/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // ignora falhas de rede — o cookie expira naturalmente
    }
  }

  const response = NextResponse.json({ ok: true });

  const clearCookie = {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "strict" as const,
    maxAge: 0,
    path: "/",
  };

  response.cookies.set("auth_token", "", clearCookie);
  response.cookies.set("refresh_token", "", clearCookie);

  return response;
}
