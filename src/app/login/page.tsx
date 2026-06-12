"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle } from "lucide-react";
import { SignInPage } from "@/components/ui/sign-in";
import { LionShield } from "@/components/layout/LionShield";
import { loginWithPassword } from "@/lib/auth/session";

function ForgotPasswordModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      toast.error("Erro de conexao.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-background p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {sent ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <CheckCircle className="size-12 text-green-500" />
            <h2 className="text-lg font-semibold">E-mail enviado!</h2>
            <p className="text-sm text-muted-foreground">
              Se o e-mail estiver cadastrado, voce recebera um link de recuperacao em breve.
            </p>
            <button
              onClick={onClose}
              className="mt-2 w-full rounded-xl bg-onyx py-3 font-medium text-silver transition-colors hover:bg-onyx/80"
            >
              Voltar ao login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">Esqueceu a senha?</h2>
              <p className="text-sm text-muted-foreground">
                Informe seu e-mail e enviaremos um link para redefinir sua senha.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="seu@email.com"
                className="mt-1 w-full rounded-xl border border-border bg-foreground/5 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber/40"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-onyx py-3 font-medium text-silver transition-colors hover:bg-onyx/80 disabled:opacity-60"
            >
              {loading ? "Enviando..." : "Enviar link"}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl border border-border py-3 text-sm font-medium transition-colors hover:bg-muted"
            >
              Cancelar
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/";
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  async function handleSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    if (!email || !password) {
      toast.error("Preencha e-mail e senha");
      return;
    }

    setLoading(true);

    try {
      await loginWithPassword(email, password);
      toast.success("Login realizado com sucesso");
      router.replace(redirect);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro de conexao.");
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
            <span className="grid size-12 shrink-0 place-items-center rounded-md bg-onyx">
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
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center text-muted-foreground">
          Carregando...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
