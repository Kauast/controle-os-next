import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;
  if (!token) return NextResponse.json({ user: null }, { status: 401 });

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return NextResponse.json({ user: null }, { status: 503 });
  }

  try {
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret);
    return NextResponse.json({ user: payload });
  } catch {
    return NextResponse.json({ user: null }, { status: 401 });
  }
}
