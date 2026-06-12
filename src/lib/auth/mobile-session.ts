import { Preferences } from "@capacitor/preferences";
import type { AuthUser } from "@/lib/auth";
import { isCapacitorApp } from "@/lib/platform/capacitor";

const ACCESS_TOKEN_KEY = "mobile_auth_access_token";
const REFRESH_TOKEN_KEY = "mobile_auth_refresh_token";
const USER_KEY = "mobile_auth_user";

async function removeItem(key: string) {
  if (!isCapacitorApp()) {
    return;
  }

  await Preferences.remove({ key });
}

async function getItem(key: string) {
  if (!isCapacitorApp()) {
    return null;
  }

  const { value } = await Preferences.get({ key });
  return value ?? null;
}

async function setItem(key: string, value: string) {
  if (!isCapacitorApp()) {
    return;
  }

  await Preferences.set({ key, value });
}

export async function getMobileAccessToken() {
  return getItem(ACCESS_TOKEN_KEY);
}

export async function getMobileRefreshToken() {
  return getItem(REFRESH_TOKEN_KEY);
}

export async function getStoredMobileUser() {
  const raw = await getItem(USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    await removeItem(USER_KEY);
    return null;
  }
}

export async function persistMobileSession(args: {
  accessToken: string;
  refreshToken?: string | null;
  user?: AuthUser | null;
}) {
  await setItem(ACCESS_TOKEN_KEY, args.accessToken);

  if (args.refreshToken) {
    await setItem(REFRESH_TOKEN_KEY, args.refreshToken);
  } else {
    await removeItem(REFRESH_TOKEN_KEY);
  }

  if (args.user) {
    await setItem(USER_KEY, JSON.stringify(args.user));
  } else {
    await removeItem(USER_KEY);
  }
}

export async function clearMobileSession() {
  await Promise.all([
    removeItem(ACCESS_TOKEN_KEY),
    removeItem(REFRESH_TOKEN_KEY),
    removeItem(USER_KEY),
  ]);
}
