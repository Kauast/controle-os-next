"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Eye, EyeOff, RefreshCw } from "lucide-react";
import { LionShield } from "@/components/layout/LionShield";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { storeMobileTokens } from "@/lib/api/mobile-client";

export default function TecnicoMobileLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/mobile-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data: { accessToken?: string; refreshToken?: string; message?: string } =
        await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.message ?? "Credenciais inválidas. Tente novamente.");
        return;
      }

      const token = data.accessToken;
      if (!token) {
        setError("Resposta inesperada do servidor.");
        return;
      }

      await storeMobileTokens(token, data.refreshToken);
      router.replace("/tecnico-mobile/");
    } catch {
      setError("Erro de conexão. Verifique o servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-[100dvh] flex flex-col items-center justify-center px-5"
      style={{
        background: "var(--color-surface-0)",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Logo + título */}
      <div className="flex flex-col items-center gap-2 mb-6">
        <div
          className="size-16"
          style={{
            color: "var(--color-amber)",
            filter: "drop-shadow(0 4px 16px rgba(245,158,11,0.35))",
          }}
        >
          <LionShield className="w-full h-full" />
        </div>
        <div className="text-center mt-1">
          <h1
            className="font-bold tracking-tight"
            style={{ fontSize: "26px", color: "var(--color-ink)" }}
          >
            GUARDIÃO
          </h1>
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--color-muted)" }}>
            App do Técnico
          </p>
        </div>
      </div>

      {/* Card do formulário */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="w-full"
        style={{ maxWidth: "360px" }}
      >
        <div
          className="w-full px-6 py-7"
          style={{
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-line-strong)",
            borderRadius: "var(--radius-xl)",
          }}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Campo e-mail */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="email"
                className="text-[13px] font-medium"
                style={{ color: "var(--color-ink-secondary)" }}
              >
                E-mail
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                disabled={loading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tecnico@empresa.com"
              />
            </div>

            {/* Campo senha com toggle */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-[13px] font-medium"
                style={{ color: "var(--color-ink-secondary)" }}
              >
                Senha
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  disabled={loading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-12"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  tabIndex={-1}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-1 top-1/2 -translate-y-1/2 size-10"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Banner de erro — AnimatePresence */}
            <AnimatePresence>
              {error && (
                <motion.div
                  key="error-banner"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <div
                    className="flex items-start gap-2.5 px-4 py-3"
                    style={{
                      background: "var(--color-red-soft)",
                      border: "1px solid var(--color-red-border)",
                      borderRadius: "var(--radius-sm)",
                    }}
                    role="alert"
                    aria-live="polite"
                  >
                    <AlertCircle
                      className="size-4 shrink-0 mt-0.5"
                      style={{ color: "var(--color-red-bright)" }}
                    />
                    <span
                      className="text-[13px] leading-snug"
                      style={{ color: "var(--color-red-bright)" }}
                    >
                      {error}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Botão Entrar */}
            <Button
              type="submit"
              variant="amber"
              size="xl"
              className="w-full"
              isLoading={loading}
              disabled={loading}
            >
              {loading ? (
                <>
                  <RefreshCw className="size-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>
        </div>
      </motion.div>

      <p className="mt-8 text-[11px] text-center" style={{ color: "var(--color-disabled)" }}>
        Problemas de acesso? Contate o administrador do sistema.
      </p>
    </div>
  );
}
