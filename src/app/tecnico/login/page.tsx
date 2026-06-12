"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LionShield } from "@/components/layout/LionShield";
import { loginWithPassword } from "@/lib/auth/session";

export default function TecnicoLoginPage() {
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
      await loginWithPassword(email, password);
      router.replace("/tecnico");
      router.refresh();
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Erro de conexao. Verifique sua internet e tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#0d0d0d] px-4">
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="size-16 text-amber-400">
          <LionShield className="h-full w-full" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white">Guardiao</h1>
          <p className="mt-0.5 text-sm text-[#a0a0a0]">Area do Tecnico</p>
        </div>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 px-6 py-7">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-[#d0d0d0]">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-[#d0d0d0]">
              Senha
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="........"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 w-full rounded-xl bg-amber-400 py-4 text-sm font-semibold text-[#0d0d0d] transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>

      <p className="mt-6 text-xs text-[#666]">
        Administrador?{" "}
        <Link href="/login" className="text-amber-400 underline underline-offset-2">
          Painel administrativo
        </Link>
      </p>
    </div>
  );
}
