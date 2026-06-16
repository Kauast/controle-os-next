"use client";

import React from "react";
import { Bell, LogIn, Menu, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/use-app-store";
import { useUIStore } from "@/store/use-ui-store";
import type { SectionKey } from "@/lib/access";

const pageMeta: Record<SectionKey, { title: string; eyebrow: string }> = {
  painel:       { title: "Dashboard",          eyebrow: "Gestão geral" },
  agenda:       { title: "Agenda",             eyebrow: "Planejamento e despacho" },
  ordens:       { title: "Ordens de Serviço",  eyebrow: "Operação e atendimento" },
  estoque:      { title: "Estoque",            eyebrow: "Almoxarifado e QR Code" },
  clientes:     { title: "Clientes",           eyebrow: "Base comercial e atendimento" },
  diretorio:    { title: "Diretório",          eyebrow: "Contatos e referências" },
  equipe:       { title: "Equipes",            eyebrow: "Técnicos e operação de campo" },
  usuarios:     { title: "Usuários",           eyebrow: "Controle de acesso" },
  rastreamento: { title: "Localização",        eyebrow: "Equipes em campo" },
  financeiro:   { title: "Financeiro",         eyebrow: "Receitas, custos e margem" },
  relatorios:   { title: "Relatórios",         eyebrow: "Gestão e supervisão" },
  auditoria:    { title: "Auditoria",          eyebrow: "Log de ações" },
};

export function Topbar() {
  const role = useAppStore((s) => s.role);
  const activeAccount = useAppStore((s) => s.activeTeamAccount);
  const section = useUIStore((s) => s.section);
  const setNewOsOpen = useUIStore((s) => s.setNewOsOpen);
  const setTeamLoginOpen = useUIStore((s) => s.setTeamLoginOpen);
  const setMobileSidebarOpen = useUIStore((s) => s.setMobileSidebarOpen);

  const meta = pageMeta[section] ?? pageMeta.painel;
  const accountLabel = activeAccount ? `${activeAccount.team} logada` : null;

  return (
    <header
      className="sticky top-0 z-40 border-b px-4 py-3 backdrop-blur-xl lg:px-7"
      style={{ borderColor: "var(--color-line)", background: "rgba(0,0,0,0.85)" }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="flex size-9 items-center justify-center rounded-[var(--radius-md)] border text-muted transition-colors hover:bg-white/8 hover:text-white lg:hidden"
            style={{ borderColor: "var(--color-line)" }}
            aria-label="Abrir menu de navegação"
          >
            <Menu className="size-4" />
          </button>
          <div>
            <p
              className="text-[10px] font-medium uppercase tracking-[0.24em]"
              style={{ fontFamily: "var(--font-mono)", color: "var(--color-muted)" }}
            >
              {meta.eyebrow}
            </p>
            <h1 className="text-base font-bold leading-tight text-white lg:text-lg">{meta.title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="icon"
            size="icon"
            aria-label="Pesquisar"
            className="size-9 rounded-[var(--radius-md)] border bg-transparent text-muted hover:bg-white/8 hover:text-white"
            style={{ borderColor: "var(--color-line)" } as React.CSSProperties}
          >
            <Search className="size-4" />
          </Button>

          <Button
            variant="icon"
            size="icon"
            aria-label="Notificações"
            className="size-9 rounded-[var(--radius-md)] border bg-transparent text-muted hover:bg-white/8 hover:text-white"
            style={{ borderColor: "var(--color-line)" } as React.CSSProperties}
          >
            <Bell className="size-4" />
          </Button>

          <button
            onClick={() => setTeamLoginOpen(true)}
            className="hidden items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-xs text-muted transition-colors hover:bg-white/8 hover:text-white lg:flex"
            style={{ borderColor: "var(--color-line)" }}
            aria-label="Login da conta de equipe"
          >
            <LogIn className="size-3.5" /> Conta equipe
          </button>

          {(role === "admin" || role === "atendimento") && (
            <button
              onClick={() => setNewOsOpen(true)}
              className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-white px-3.5 py-2 text-xs font-semibold text-black transition-all hover:bg-[#E8E8E8] active:scale-[0.97]"
              aria-label="Criar nova ordem de serviço"
            >
              <Plus className="size-3.5" /> Nova OS
            </button>
          )}

          {accountLabel && (
            <span
              className="hidden rounded-[var(--radius-sm)] border px-3 py-1.5 text-[10px]"
              style={{
                fontFamily: "var(--font-mono)",
                borderColor: "var(--color-line)",
                color: "var(--color-muted)",
                background: "var(--color-surface-2)",
              }}
            >
              {accountLabel}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
