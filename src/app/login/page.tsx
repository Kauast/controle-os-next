"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LionShield } from "@/components/layout/LionShield";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? data?.message ?? "Credenciais inválidas.");
        return;
      }
      const params = new URLSearchParams(window.location.search);
      router.replace(params.get("redirect") ?? "/");
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 bg-dark">
      <div className="flex flex-col items-center gap-2 mb-8">
        <div className="size-14 text-teal">
          <LionShield className="w-full h-full" />
        </div>
        <h1 className="text-2xl font-bold text-ink tracking-tight">GUARDIÃO</h1>
        <p className="text-sm text-muted">Sistema de Gestão de OS</p>
      </div>

      <div className="w-full max-w-sm rounded-[var(--radius-xl)] border border-line bg-panel px-6 py-7">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-ink-secondary">E-mail</label>
            <Input id="email" type="email" autoComplete="email" required
              value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-ink-secondary">Senha</label>
            <div className="relative">
              <Input id="password" type={showPwd ? "text" : "password"} autoComplete="current-password"
                required value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" className="pr-12" />
              <Button type="button" variant="ghost" size="icon" tabIndex={-1}
                aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
                className="absolute right-1 top-1/2 -translate-y-1/2 size-10"
                onClick={() => setShowPwd(v => !v)}>
                {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" className="w-full mt-1" isLoading={loading} disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
