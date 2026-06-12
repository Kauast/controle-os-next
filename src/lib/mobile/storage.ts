import { Capacitor } from "@capacitor/core";

const TOKEN_KEY = "mobile_auth_token";

async function getPreferences() {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { Preferences } = await import("@capacitor/preferences");
    return Preferences;
  } catch {
    return null;
  }
}

export async function getToken(): Promise<string | null> {
  const prefs = await getPreferences();
  if (prefs) {
    const { value } = await prefs.get({ key: TOKEN_KEY });
    return value;
  }
  if (typeof window !== "undefined") return localStorage.getItem(TOKEN_KEY);
  return null;
}

export async function setToken(token: string): Promise<void> {
  const prefs = await getPreferences();
  if (prefs) {
    await prefs.set({ key: TOKEN_KEY, value: token });
  } else if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export async function clearToken(): Promise<void> {
  const prefs = await getPreferences();
  if (prefs) {
    await prefs.remove({ key: TOKEN_KEY });
  } else if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export async function getPref(key: string): Promise<string | null> {
  const prefs = await getPreferences();
  if (prefs) {
    const { value } = await prefs.get({ key });
    return value;
  }
  if (typeof window !== "undefined") return localStorage.getItem(key);
  return null;
}

export async function setPref(key: string, value: string): Promise<void> {
  const prefs = await getPreferences();
  if (prefs) {
    await prefs.set({ key, value });
  } else if (typeof window !== "undefined") {
    localStorage.setItem(key, value);
  }
}
