import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:3333";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const forwarded = request.headers.get("x-forwarded-proto") ?? "https";
  const host      = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost";

  const res = await fetch(`${BACKEND}/api/auth/forgot-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-proto": forwarded,
      "x-forwarded-host":  host,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
