import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/api/backend-config";

const BACKEND = BACKEND_URL;

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
