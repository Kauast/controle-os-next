import {
  clearMobileSession,
  getMobileAccessToken,
  persistMobileSession,
} from "@/lib/auth/mobile-session";

export async function getMobileToken() {
  return getMobileAccessToken();
}

export async function setMobileToken(token: string) {
  await persistMobileSession({ accessToken: token });
}

export async function clearMobileToken() {
  await clearMobileSession();
}
