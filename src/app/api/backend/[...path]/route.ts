import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/api/backend-config";
import { validateCsrf, MUTABLE_METHODS } from "@/lib/api/csrf-validate";

const BACKEND = BACKEND_URL;

const ALLOWED_PREFIXES = new Set([
  "auth",
  "clients",
  "service-orders",
  "technicians",
  "products",
  "reports",
  "material-requests",
  "chips",
  "uploads",
  "users",
  "audit",
  "ai",
  "attachments",
  "teams",
  "financial",
]);

const BLOCKED_PREFIXES = new Set(["metrics", "health", "internal", "admin"]);

function isPathSafe(segments: string[]): boolean {
  if (segments.length === 0) return false;
  for (const seg of segments) {
    if (!seg) return false;
    if (seg === ".." || seg === ".") return false;
    if (/[\x00-\x1f\x7f\\]/.test(seg)) return false;
  }
  return true;
}

async function proxy(request: NextRequest, path: string[]): Promise<NextResponse> {
  if (!isPathSafe(path)) {
    return NextResponse.json({ error: "Path invalido" }, { status: 400 });
  }

  const prefix = path[0].toLowerCase();

  if (BLOCKED_PREFIXES.has(prefix)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!ALLOWED_PREFIXES.has(prefix)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (MUTABLE_METHODS.has(request.method)) {
    const csrfError = validateCsrf(request);
    if (csrfError) return csrfError;
  }

  const token = request.cookies.get("auth_token")?.value;
  const url = new URL(`/api/${path.join("/")}`, BACKEND);
  url.search = request.nextUrl.search;

  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const contentType = request.headers.get("content-type");

  let body: BodyInit | undefined;
  if (request.method !== "GET" && request.method !== "HEAD" && request.method !== "DELETE") {
    if (contentType?.includes("multipart/form-data")) {
      body = await request.blob();
      const boundary = contentType.split("boundary=")[1];
      if (boundary) headers["Content-Type"] = contentType;
    } else {
      const text = await request.text();
      if (text) {
        body = text;
        headers["Content-Type"] = contentType ?? "application/json";
      }
    }
  }

  const res = await fetch(url.toString(), {
    method: request.method,
    headers,
    body,
  });

  const data = await res.text();
  return new NextResponse(data || null, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, (await params).path);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, (await params).path);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, (await params).path);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, (await params).path);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, (await params).path);
}
