import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/api/backend-config";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const refreshToken = (body as { refreshToken?: string }).refreshToken;
  if (!refreshToken) {
    return NextResponse.json({ error: "refreshToken obrigatório" }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }

  return NextResponse.json({
    accessToken: (data as { accessToken?: string }).accessToken,
    refreshToken: (data as { refreshToken?: string }).refreshToken,
    user: (data as { user?: unknown }).user,
  });
}
