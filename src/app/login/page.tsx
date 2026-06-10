"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle } from "lucide-react";
import { SignInPage } from "@/components/ui/sign-in";
import { LionShield } from "@/components/layout/LionShield";

function ForgotPasswordModal({ onClose }: { onClose: () => void }) {
  const [email,   setEmail]   = useState("");
  const [sent,    setSent]    = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      toast.error("Erro de conexao.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-background border border-border p-8 space-y-5 shadow-2xl"
           onClick={(e) => e.stopPropagation()}>
        {sent ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <CheckCircle className="size-12 text-green-500" />
            <h2 className="text-lg font-semibold">E-mail enviado!</h2>
            <p className="text-sm text-muted-foreground">
              Se o e-mail estiver cadastrado, voce recebera um link de recuperacao em breve.
            </p>
            <button onClick={onClose}
              className="mt-2 w-full rounded-xl bg-onyx py-3 font-medium text-silver hover:bg-onyx/80 transition-colors">
              Voltar ao login
            </button>
          </div>
        ) : (
          <>
            <div>
              <h2 className="text-xl font-semibold">Esqueceu a senha?</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Informe seu e-mail e enviaremos um link para redefinir sua senha.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">E-mail</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  placeholder="seu@email.com" autoFocus
                  className="mt-1 w-full rounded-xl border border-border bg-foreground/5 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber/40" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full rounded-xl bg-onyx py-3 font-medium text-silver hover:bg-onyx/80 disabled:opacity-60 transition-colors">
                {loading ? "Enviando..." : "Enviar link"}
              </button>
              <button type="button" onClick={onClose}
                className="w-full rounded-xl border border-border py-3 text-sm font-medium hover:bg-muted transition-colors">
                Cancelar
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const redirect     = searchParams.get("redirect") ?? "/";
  const [loading,      setLoading]      = useState(false);
  const [showForgot,   setShowForgot]   = useState(false);

  async function handleSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email    = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) { toast.error("Preencha e-mail e senha"); return; }

    setLoading(true);
    try {
      const res  = await fetch("/api/auth/login", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Credenciais invalidas"); return; }
      toast.success("Login realizado com sucesso");
      router.replace(redirect);
      router.refresh();
    } catch {
      toast.error("Erro de conexao. Verifique se o servidor esta rodando.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
      <SignInPage
        title={
          <span className="flex items-center gap-4">
            <span className="size-12 rounded-md bg-onyx grid place-items-center shrink-0">
              <LionShield className="size-8 text-silver" />
            </span>
            <span className="font-semibold tracking-tight">Guardiao</span>
          </span>
        }
        description="Acesse sua conta para gerenciar ordens de servico, equipes e estoque."
        heroImageSrc="/hero-login.jpg"
        onSignIn={handleSignIn}
        onResetPassword={() => setShowForgot(true)}
        loading={loading}
      />
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center text-muted-foreground">Carregando...</div>}>
      <LoginForm />
    </Suspense>
  );
}
