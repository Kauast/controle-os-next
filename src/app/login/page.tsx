"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});
type Form = z.infer<typeof schema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/";
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  async function submit(data: Form) {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
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
    <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
      <Label>
        E-mail
        <Input
          {...register("email")}
          type="email"
          placeholder="seu@email.com"
          autoComplete="email"
          disabled={loading}
        />
        {errors.email && (
          <span className="text-[11px] text-red">{errors.email.message}</span>
        )}
      </Label>
      <Label>
        Senha
        <Input
          {...register("password")}
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          disabled={loading}
        />
        {errors.password && (
          <span className="text-[11px] text-red">{errors.password.message}</span>
        )}
      </Label>
      <Button type="submit" className="mt-2 w-full" disabled={loading}>
        {loading ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-panel px-4">
      <div className="w-full max-w-sm rounded-[20px] border border-line bg-panel-soft p-8 shadow-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Image src="/logo.svg" alt="Logo" width={56} height={56} className="rounded-[14px]" />
          <div className="text-center">
            <h1 className="text-xl font-bold text-ink">Controle OS</h1>
            <p className="text-sm text-muted">Faça login para continuar</p>
          </div>
        </div>
        <Suspense fallback={<div className="h-32 animate-pulse rounded-[12px] bg-panel-soft" />}>
          <LoginForm />
        </Suspense>
        <div className="mt-6 rounded-[12px] bg-panel p-3 text-[11px] text-muted">
          <strong className="text-ink">Usuários de demonstração</strong>
          <div className="mt-1 grid grid-cols-2 gap-1">
            {[
              ["admin@controle.com", "admin123"],
              ["estoque@controle.com", "estoque123"],
              ["tecnico@controle.com", "tecnico123"],
              ["atendimento@controle.com", "atend123"],
            ].map(([email, pass]) => (
              <span key={email}>
                {email.split("@")[0]}: <code>{pass}</code>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
