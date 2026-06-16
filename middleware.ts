import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// /tecnico-mobile é gerenciado pela própria página via localStorage (APK/Capacitor)
const PUBLIC = ["/login", "/api/auth", "/tecnico/login", "/tecnico-mobile"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic =
    PUBLIC.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon");

  if (isPublic) return NextResponse.next();

  const isApiProxy = pathname.startsWith("/api/backend");
  const isTecnicoArea = pathname.startsWith("/tecnico");

  const token = request.cookies.get("auth_token")?.value;

  if (!token) {
    if (isApiProxy) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const loginUrl = new URL(isTecnicoArea ? "/tecnico/login" : "/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    // Configuração crítica ausente — não deixar passar
    if (isApiProxy) return NextResponse.json({ error: "Configuração inválida" }, { status: 503 });
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret);
    const role = (payload as { role?: string }).role ?? "";

    // TECHNICIAN só acessa /tecnico
    if (role === "TECHNICIAN") {
      if (!isTecnicoArea) {
        return NextResponse.redirect(new URL("/tecnico", request.url));
      }
      return NextResponse.next();
    }

    // TECHNICIAN tentando acessar /tecnico é ok; outros perfis são redirecionados ao login principal
    if (isTecnicoArea && role !== "TECHNICIAN") {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  } catch {
    if (isApiProxy) return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    const loginUrl = new URL(isTecnicoArea ? "/tecnico/login" : "/login", request.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete("auth_token");
    return response;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.svg|.*\.svg).*)"],
};
