"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { SignInPage, type Testimonial } from "@/components/ui/sign-in";
import { LionShield } from "@/components/layout/LionShield";

const testimonials: Testimonial[] = [
  {
    avatarSrc: "https://randomuser.me/api/portraits/women/44.jpg",
    name: "Ana Paula",
    handle: "@anapaula_ops",
    text: "O despacho por equipes ficou muito mais ágil. Visualizo tudo em tempo real e consigo reorganizar as OS sem sair da tela.",
  },
  {
    avatarSrc: "https://randomuser.me/api/portraits/men/52.jpg",
    name: "Ricardo Souza",
    handle: "@ricardotech",
    text: "O app do técnico no celular é muito prático. Faço check-in, tiro fotos e registro o chip direto no campo.",
  },
  {
    avatarSrc: "https://randomuser.me/api/portraits/men/18.jpg",
    name: "Carlos Lima",
    handle: "@carlos_gestao",
    text: "Relatórios e controle de estoque na mesma plataforma. Acabaram os e-mails e planilhas avulsas.",
  },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/";
  const [loading, setLoading] = useState(false);

  async function handleSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
      toast.error("Preencha e-mail e senha");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Credenciais inválidas");
        return;
      }
      toast.success("Login realizado com sucesso");
      router.replace(redirect);
      router.refresh();
    } catch {
      toast.error("Erro de conexão. Verifique se o servidor está rodando.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SignInPage
      title={
        <span className="flex items-center gap-4">
          <span className="size-12 rounded-md bg-onyx grid place-items-center shrink-0">
            <LionShield className="size-8 text-silver" />
          </span>
          <span className="font-semibold tracking-tight">Guardião</span>
        </span>
      }
      description="Acesse sua conta para gerenciar ordens de serviço, equipes e estoque."
      heroImageSrc="https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=2160&q=80"
      testimonials={testimonials}
      onSignIn={handleSignIn}
      loading={loading}
    />
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center text-muted-foreground">Carregando...</div>}>
      <LoginForm />
    </Suspense>
  );
}
