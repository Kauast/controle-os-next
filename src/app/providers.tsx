"use client";

import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { queryClient } from "@/lib/react-query/queryClient";
import { useAuthStore } from "@/store/use-auth-store";
import { useAppStore } from "@/store/use-app-store";
import { initAuth } from "@/hooks/useAuth";

function AuthInitializer() {
  const setUser = useAuthStore((s) => s.setUser);
  const setRole = useAppStore((s) => s.setRole);

  useEffect(() => {
    const hasCsrf = document.cookie.includes("csrf_token=");
    if (!hasCsrf) fetch("/api/auth/csrf").catch(() => undefined);

    void initAuth(setUser, setRole);
  }, [setUser, setRole]);

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
