"use client";

import { useAuthStore } from "@/store/use-auth-store";
import { useAppStore } from "@/store/use-app-store";
import { backendRoleToFrontend } from "@/lib/auth";
import type { AuthUser } from "@/lib/auth";
import type { Role } from "@/lib/types";

interface UseAuthReturn {
  user: AuthUser | null;
  role: Role;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

/**
 * Single auth seam. Source of truth for user, role, and loading state.
 * Wraps useAuthStore (user/loading) and useAppStore (role).
 */
export function useAuth(): UseAuthReturn {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const role = useAppStore((s) => s.role);
  const setUser = useAuthStore((s) => s.setUser);
  const clear = useAuthStore((s) => s.clear);
  const setRole = useAppStore((s) => s.setRole);

  async function login(email: string, password: string): Promise<AuthUser> {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = (await res.json()) as { user?: AuthUser; message?: string };
    if (!res.ok) throw new Error(data.message ?? "Credenciais inválidas.");
    if (!data.user) throw new Error("Resposta inesperada do servidor.");
    setUser(data.user);
    setRole(backendRoleToFrontend(data.user.role));
    return data.user;
  }

  async function logout(): Promise<void> {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // network failure — local logout is mandatory regardless
    }
    clear();
    setRole("admin");
    if (typeof window !== "undefined") window.location.href = "/login";
  }

  return { user, role, loading, login, logout };
}

/**
 * Initializes auth state by fetching /api/auth/me.
 * Call once in AuthInitializer (providers.tsx).
 */
export async function initAuth(
  setUser: (user: AuthUser | null) => void,
  setRole: (role: Role) => void
): Promise<void> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch("/api/auth/me", { signal: controller.signal });
    clearTimeout(timeout);

    const data = res.ok ? ((await res.json()) as { user?: AuthUser }) : null;

    if (data?.user) {
      setUser(data.user);
      setRole(backendRoleToFrontend(data.user.role));
    } else {
      setUser(null);
    }
  } catch {
    setUser(null);
  }
}
