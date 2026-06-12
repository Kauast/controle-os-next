"use client";

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
    <header className="sticky top-0 z-40 border-b border-line bg-panel-soft/90 px-4 py-3 backdrop-blur-xl lg:px-7">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="flex size-9 items-center justify-center rounded-xl border border-line text-muted transition-colors hover:bg-white/10 hover:text-ink lg:hidden"
            aria-label="Abrir menu de navegação"
          >
            <Menu className="size-4" />
          </button>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">{meta.eyebrow}</p>
            <h1 className="text-lg font-bold leading-tight text-ink lg:text-xl">{meta.title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="icon"
            size="icon"
            aria-label="Pesquisar"
            className="size-9 rounded-xl border border-line bg-transparent text-muted hover:bg-white/10 hover:text-ink"
          >
            <Search className="size-4" />
          </Button>

          <Button
            variant="icon"
            size="icon"
            aria-label="Notificações"
            className="size-9 rounded-xl border border-line bg-transparent text-muted hover:bg-white/10 hover:text-ink"
          >
            <Bell className="size-4" />
          </Button>

          <button
            onClick={() => setTeamLoginOpen(true)}
            className="hidden items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm text-muted transition-colors hover:bg-white/10 hover:text-ink lg:flex"
            aria-label="Login da conta de equipe"
          >
            <LogIn className="size-4" /> Conta equipe
          </button>

          {(role === "admin" || role === "atendimento") && (
            <button
              onClick={() => setNewOsOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
              aria-label="Criar nova ordem de serviço"
            >
              <Plus className="size-4" /> Nova OS
            </button>
          )}

          {accountLabel && (
            <span className="hidden rounded-full border border-line bg-panel px-3 py-1.5 text-xs text-muted lg:block">
              {accountLabel}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
