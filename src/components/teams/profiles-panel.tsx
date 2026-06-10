"use client";

import { Card, SectionHeading } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUsers } from "@/hooks/useUsers";

const profiles = [
  { role: "Administrador", desc: "Ve tudo, faturamento, estoque, OS, relatorios e aprova materiais." },
  { role: "Responsavel estoque", desc: "Cadastra produtos, movimenta estoque, aprova, separa e confirma retirada." },
  { role: "Instrutor de OS", desc: "Cria e edita OS, vincula cliente/tecnico e solicita material sem alterar estoque." },
  { role: "Tecnico de campo", desc: "Ve apenas suas OS, atualiza status, adiciona fotos, assinatura e solicita material." },
  { role: "Atendimento", desc: "Gerencia agenda, equipes e OS sem visualizar estoque ou financeiro." },
];

const roleLabel: Record<string, string> = {
  ADMIN: "Administrador",
  STOCK: "Estoque",
  TECHNICIAN: "Tecnico",
  ATTENDANT: "Atendente",
  FINANCIAL: "Financeiro",
};

const roleTone: Record<string, "teal" | "amber" | "dark"> = {
  ADMIN: "dark",
  STOCK: "amber",
  TECHNICIAN: "teal",
  ATTENDANT: "teal",
  FINANCIAL: "amber",
};

export function ProfilesPanel() {
  const { data: users = [], isLoading } = useUsers();

  return (
    <Card>
      <SectionHeading eyebrow="Autenticacao e autorizacao" title="Perfis de usuario">
        <Badge tone="dark">Regras de acesso</Badge>
      </SectionHeading>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {profiles.map((p) => (
          <article key={p.role} className="rounded-[12px] border border-line bg-panel-soft/40 p-4">
            <strong className="block text-sm text-ink">{p.role}</strong>
            <span className="text-xs text-muted">{p.desc}</span>
          </article>
        ))}
      </div>

      <div className="mt-4 rounded-[14px] border border-line bg-panel-soft/40 p-4">
        <strong className="mb-3 block text-sm text-ink">Usuarios cadastrados</strong>
        {isLoading ? (
          <p className="text-xs text-muted">Carregando...</p>
        ) : users.length === 0 ? (
          <p className="text-xs text-muted">Nenhum usuario cadastrado.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {users.map((u) => (
              <article key={u.id} className="rounded-[10px] border border-line bg-panel p-3">
                <div className="flex items-center justify-between gap-2">
                  <strong className="block truncate text-sm text-ink">{u.email}</strong>
                  <Badge tone={roleTone[u.role] ?? "dark"}>{roleLabel[u.role] ?? u.role}</Badge>
                </div>
                <small className="block text-xs text-muted">{u.active ? "Ativo" : "Inativo"}</small>
              </article>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
