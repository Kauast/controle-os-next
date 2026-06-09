"use client";

import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
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
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { user: AuthUser } | null) => {
        if (data?.user) {
          setUser(data.user);
          setRole(backendRoleToFrontend(data.user.role));
        } else {
          setUser(null);
        }
      })
      .catch(() => setLoading(false));
  }, [setUser, setLoading, setRole]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer />
      {children}
      <Toaster richColors position="top-right" />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
