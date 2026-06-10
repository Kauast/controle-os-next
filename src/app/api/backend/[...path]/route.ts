import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:3333";

async function proxy(request: NextRequest, path: string[]) {
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

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await params).path);
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await params).path);
}
export async function PUT(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await params).path);
}
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await params).path);
}
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await params).path);
}
