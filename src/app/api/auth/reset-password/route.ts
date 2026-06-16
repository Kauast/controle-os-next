import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/api/backend-config";

const BACKEND = BACKEND_URL;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const res = await fetch(`${BACKEND}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
