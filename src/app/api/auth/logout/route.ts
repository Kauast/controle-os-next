import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL, COOKIE_BASE } from "@/lib/api/backend-config";

const BACKEND = BACKEND_URL;

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

  const clearCookie = { ...COOKIE_BASE, maxAge: 0 };

  response.cookies.set("auth_token", "", clearCookie);
  response.cookies.set("refresh_token", "", clearCookie);

  return response;
}
