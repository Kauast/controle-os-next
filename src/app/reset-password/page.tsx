"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, CheckCircle } from "lucide-react";
import { LionShield } from "@/components/layout/LionShield";

function ResetForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token        = searchParams.get("token") ?? "";
  const [password, setPassword]     = useState("");
  const [confirm,  setConfirm]      = useState("");
  const [showPw,   setShowPw]       = useState(false);
  const [loading,  setLoading]      = useState(false);
  const [success,  setSuccess]      = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { toast.error("Senha deve ter no minimo 8 caracteres."); return; }
    if (password !== confirm) { toast.error("As senhas nao conferem."); return; }
    if (!token)               { toast.error("Link invalido."); return; }

    setLoading(true);
    try {
      const res  = await fetch("/api/auth/reset-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token, password }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Link invalido ou expirado."); return; }
      setSuccess(true);
      setTimeout(() => router.replace("/login"), 3000);
    } catch {
      toast.error("Erro de conexao.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <CheckCircle className="size-14 text-green-500" />
        <h2 className="text-xl font-semibold">Senha redefinida!</h2>
        <p className="text-muted-foreground text-sm">Redirecionando para o login...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="text-sm font-medium text-muted-foreground">Nova senha</label>
        <div className="relative mt-1">
          <input
            type={showPw ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimo 8 caracteres"
            required
            className="w-full rounded-xl border border-border bg-foreground/5 px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-amber/40"
          />
          <button type="button" onClick={() => setShowPw((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-muted-foreground">Confirmar nova senha</label>
        <div className="mt-1">
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repita a senha"
            required
            className="w-full rounded-xl border border-border bg-foreground/5 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber/40"
          />
        </div>
      </div>
      <button type="submit" disabled={loading}
        className="w-full rounded-xl bg-onyx py-4 font-medium text-silver hover:bg-onyx/80 disabled:opacity-60 transition-colors">
        {loading ? "Salvando..." : "Definir nova senha"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-3">
          <div className="size-14 rounded-xl bg-onyx grid place-items-center">
            <LionShield className="size-9 text-silver" />
          </div>
          <h1 className="text-2xl font-semibold">Redefinir senha</h1>
          <p className="text-sm text-muted-foreground text-center">Digite sua nova senha para continuar.</p>
        </div>
        <Suspense fallback={<p className="text-center text-sm text-muted-foreground">Carregando...</p>}>
          <ResetForm />
        </Suspense>
        <p className="text-center">
          <a href="/login" className="text-sm text-amber hover:underline">Voltar ao login</a>
        </p>
      </div>
    </div>
  );
}
