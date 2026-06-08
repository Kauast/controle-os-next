"use client";

import { Card, SectionHeading } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { teamAccounts } from "@/store/use-app-store";

const profiles = [
  { role: "Administrador", desc: "Ve tudo, faturamento, estoque, OS, relatorios e aprova materiais." },
  { role: "Responsavel estoque", desc: "Cadastra produtos, movimenta estoque, aprova, separa e confirma retirada." },
  { role: "Instrutor de OS", desc: "Cria e edita OS, vincula cliente/tecnico e solicita material sem alterar estoque." },
  { role: "Tecnico de campo", desc: "Ve apenas suas OS, atualiza status, adiciona fotos, assinatura e solicita material." },
  { role: "Atendimento", desc: "Gerencia agenda, equipes e OS sem visualizar estoque ou financeiro." },
];

export function ProfilesPanel() {
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
        <strong className="mb-3 block text-sm text-ink">Contas locais por equipe</strong>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {teamAccounts.map((a) => (
            <article key={a.team} className="rounded-[10px] border border-line bg-panel p-3">
              <strong className="block text-sm text-ink">{a.team}</strong>
              <small className="block text-xs text-muted">Usuario: {a.user}</small>
              <small className="block text-xs text-muted">Senha inicial: {a.password}</small>
              <small className="block text-xs text-muted">{a.members}</small>
            </article>
          ))}
        </div>
      </div>
    </Card>
  );
}
