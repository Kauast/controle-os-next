"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LionShield } from "@/components/layout/LionShield";
import { storeMobileToken } from "@/lib/api/mobile-client";

const FASTIFY_URL = process.env.NEXT_PUBLIC_FASTIFY_URL ?? "http://localhost:3333";

export default function TecnicoMobileLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${FASTIFY_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data: { token?: string; accessToken?: string; access_token?: string; message?: string } =
        await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.message ?? "Credenciais inválidas. Tente novamente.");
        return;
      }

      const token = data.token ?? data.accessToken ?? data.access_token;
      if (!token) {
        setError("Resposta inesperada do servidor.");
        return;
      }

      // Usa Capacitor Preferences no app nativo, localStorage no navegador
      await storeMobileToken(token);
      router.replace("/tecnico-mobile/");
    } catch {
      setError("Erro de conexão. Verifique o servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[#0d0d0d] flex flex-col items-center justify-center px-4 pt-safe-top pb-safe-bottom">
      <div className="flex flex-col items-center gap-3 mb-8">
        <div className="size-16 text-amber-400">
          <LionShield className="w-full h-full" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white tracking-tight">Guardião</h1>
          <p className="text-sm text-white/50 mt-0.5">App do Técnico</p>
        </div>
      </div>

      <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-2xl px-6 py-7">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-white/70">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tecnico@empresa.com"
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3.5 text-white placeholder:text-white/25 text-sm outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-colors min-h-[48px]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-white/70">
              Senha
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3.5 text-white placeholder:text-white/25 text-sm outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-colors min-h-[48px]"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2.5">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-400 text-[#0d0d0d] rounded-xl py-4 font-semibold text-sm mt-1 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity min-h-[52px]"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>

      <p className="mt-6 text-xs text-white/30">
        Servidor:{" "}
        <span className="font-mono text-white/50 select-all">
          {FASTIFY_URL}
        </span>
      </p>
    </div>
  );
}
