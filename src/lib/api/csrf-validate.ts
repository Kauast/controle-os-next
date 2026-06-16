import type { NextRequest, NextResponse as NR } from "next/server";
import { NextResponse } from "next/server";
import { IS_PROD } from "@/lib/api/backend-config";

// Metodos que alteram estado — exigem token CSRF.
export const MUTABLE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Comparacao em tempo aproximadamente constante para strings de mesmo comprimento.
 * Evita timing-oracle sem depender de modulo nativo do Node.
 */
function safeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Host canonico da aplicacao Next.js, respeitando proxies reversos. */
function getAppHost(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    ""
  );
}

/**
 * Valida o token CSRF via Double Submit Cookie.
 * Retorna um NextResponse 403 em caso de falha, ou null se tudo estiver ok.
 */
export function validateCsrf(request: NextRequest): NR | null {
  const csrfCookie = request.cookies.get("csrf_token")?.value;
  const csrfHeader = request.headers.get("x-csrf-token");

  if (!csrfCookie || !csrfHeader) {
    return NextResponse.json({ error: "CSRF token ausente" }, { status: 403 });
  }

  if (!safeEquals(csrfCookie, csrfHeader)) {
    return NextResponse.json({ error: "CSRF token invalido" }, { status: 403 });
  }

  // Valida Origin (presente em todos os browsers modernos para requisicoes cross-origin)
  const origin = request.headers.get("origin");
  const appHost = getAppHost(request);
  if (origin) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== appHost) {
        return NextResponse.json({ error: "Origin nao permitida" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Origin invalida" }, { status: 403 });
    }
  }

  // Em producao valida tambem o Referer como camada adicional
  if (IS_PROD) {
    const referer = request.headers.get("referer");
    if (referer) {
      try {
        const refHost = new URL(referer).host;
        if (refHost !== appHost) {
          return NextResponse.json({ error: "Referer nao permitido" }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: "Referer invalido" }, { status: 403 });
      }
    }
  }

  return null; // ok
}
