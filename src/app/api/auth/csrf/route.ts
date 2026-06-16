import { NextResponse } from "next/server";

const IS_PROD = process.env.NODE_ENV === "production";

export async function GET() {
  const response = NextResponse.json({ ok: true });
  const token = crypto.randomUUID().replace(/-/g, "");

  response.cookies.set("csrf_token", token, {
    httpOnly: false,
    secure: IS_PROD,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return response;
}
