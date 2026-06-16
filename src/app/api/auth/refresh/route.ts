import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL, COOKIE_BASE } from "@/lib/api/backend-config";

const BACKEND = BACKEND_URL;

export async function POST(request: NextRequest) {
  // Lê o refresh token do cookie httpOnly — nunca exposto ao JS do cliente
  const refreshToken = request.cookies.get("refresh_token")?.value;

  if (!refreshToken) {
    const response = NextResponse.json(
      { error: "Sessão expirada. Faça login novamente." },
      { status: 401 }
    );
    // Limpa cookies residuais
    response.cookies.delete("auth_token");
    response.cookies.delete("refresh_token");
    return response;
  }

  let res: Response;
  try {
    // Chama o Fastify server-to-server; envia o refreshToken no body conforme contrato
    res = await fetch(`${BACKEND}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    return NextResponse.json(
      { error: "Serviço indisponível. Tente novamente." },
      { status: 503 }
    );
  }

  // Fastify respondeu com erro (401 = inválido/expirado/revogado, 429 = rate limit)
  if (!res.ok) {
    const response = NextResponse.json(
      { error: "Sessão expirada. Faça login novamente." },
      { status: res.status === 429 ? 429 : 401 }
    );
    // Em caso de 401, limpa os cookies — sessão inválida
    if (res.status === 401) {
      response.cookies.delete("auth_token");
      response.cookies.delete("refresh_token");
    }
    return response;
  }

  const data = (await res.json()) as { accessToken: string; refreshToken: string };

  // Re-seta os cookies httpOnly com os novos tokens rotacionados
  // Espelha exatamente as mesmas flags e expirações do login
  const response = NextResponse.json({ ok: true });

  response.cookies.set("auth_token", data.accessToken, {
    ...COOKIE_BASE,
    maxAge: 60 * 60 * 8, // 8h — mesma expiração do login
  });

  response.cookies.set("refresh_token", data.refreshToken, {
    ...COOKIE_BASE,
    maxAge: 60 * 60 * 24 * 7, // 7 dias — mesma expiração do login
  });

  return response;
}
