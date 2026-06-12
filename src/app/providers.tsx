"use client";

import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "sonner";
import { queryClient } from "@/lib/react-query/queryClient";
import { useAuthStore } from "@/store/use-auth-store";
import { useAppStore } from "@/store/use-app-store";
import {
  fetchCurrentSessionProfile,
  getFrontendRole,
  toAuthStoreUser,
} from "@/lib/auth/session";
import { getStoredMobileUser } from "@/lib/auth/mobile-session";
import { isCapacitorApp } from "@/lib/platform/capacitor";

function AuthInitializer() {
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);
  const clear = useAuthStore((s) => s.clear);
  const setRole = useAppStore((s) => s.setRole);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapSession() {
      try {
        const profile = await fetchCurrentSessionProfile();
        if (cancelled) {
          return;
        }

        setUser(toAuthStoreUser(profile));
        setRole(getFrontendRole(profile.role));
      } catch {
        if (cancelled) {
          return;
        }

        if (isCapacitorApp()) {
          const storedUser = await getStoredMobileUser();
          if (storedUser && !cancelled) {
            setUser(storedUser);
            setRole(getFrontendRole(storedUser.role));
            return;
          }
        }

        clear();
        setLoading(false);
      }
    }

    bootstrapSession();

    return () => {
      cancelled = true;
    };
  }, [clear, setLoading, setRole, setUser]);

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
