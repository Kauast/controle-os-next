"use client";

import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { queryClient } from "@/lib/react-query/queryClient";
import { useAuthStore } from "@/store/use-auth-store";
import { useAppStore } from "@/store/use-app-store";
import { backendRoleToFrontend } from "@/lib/auth";
import type { AuthUser } from "@/lib/auth";

function AuthInitializer() {
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);
  const setRole = useAppStore((s) => s.setRole);

  useEffect(() => {
    // Garante que o cookie csrf_token existe antes da primeira mutação.
    // Não bloqueia: se falhar, o cookie simplesmente não estará presente
    // e o servidor retornará 403 na próxima mutação (usuário verá erro).
    const hasCsrf = document.cookie.includes("csrf_token=");
    if (!hasCsrf) {
      fetch("/api/auth/csrf").catch(() => undefined);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    fetch("/api/auth/me", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { user: AuthUser } | null) => {
        clearTimeout(timeout);
        if (data?.user) {
          setUser(data.user);
          setRole(backendRoleToFrontend(data.user.role));
        } else {
          setUser(null);
        }
      })
      .catch(() => {
        clearTimeout(timeout);
        setUser(null);
      });
  }, [setUser, setLoading, setRole]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer />
      {children}
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
