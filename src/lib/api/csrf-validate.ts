import { NextRequest, NextResponse } from "next/server";

export const MUTABLE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function validateCsrf(request: NextRequest): NextResponse | null {
  const cookieToken = request.cookies.get("csrf_token")?.value;
  const headerToken = request.headers.get("x-csrf-token");

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return NextResponse.json({ error: "CSRF token invalido" }, { status: 403 });
  }

  return null;
}
