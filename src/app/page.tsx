"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Smartphone } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Metrics } from "@/components/dashboard/metrics";
import { AgendaPanel } from "@/components/dashboard/agenda-panel";
import { DispatchBoard } from "@/components/dashboard/dispatch-board";
import { OrderQueue } from "@/components/dashboard/order-queue";
import { OsKanban } from "@/components/os/os-kanban";
import { StockPanel } from "@/components/stock/stock-panel";
import { ReportsPanel } from "@/components/reports/reports-panel";
import { FinancePanel } from "@/components/finance/finance-panel";
import { TrackingPanel } from "@/components/tracking/tracking-panel";
import { TeamsPanel } from "@/components/teams/teams-panel";
import { ProfilesPanel } from "@/components/teams/profiles-panel";
import { ClientsPanel } from "@/components/clients/clients-panel";
import { ClientsDirectory } from "@/components/clients/clients-directory";
import { NewOsDialog } from "@/components/dialogs/new-os-dialog";
import { ScheduleDialog } from "@/components/dialogs/schedule-dialog";
import { TeamLoginDialog } from "@/components/dialogs/team-login-dialog";
import { AuditPanel } from "@/components/dashboard/audit-panel";
import { canAccessSection, defaultSection, type SectionKey } from "@/lib/access";
import { useAppStore } from "@/store/use-app-store";
import { useAuthStore } from "@/store/use-auth-store";
import { useUIStore } from "@/store/use-ui-store";
import { useHydrated } from "@/hooks/use-hydrated";

function SectionView({ section }: { section: SectionKey }) {
  switch (section) {
    case "painel":
      return (
        <div className="flex flex-col gap-5">
          <Metrics />
          <DispatchBoard />
          <OrderQueue />
        </div>
      );
    case "agenda":
      return (
        <div className="flex flex-col gap-5">
          <DispatchBoard />
          <AgendaPanel />
        </div>
      );
    case "ordens":
      return <OsKanban />;
    case "estoque":
      return <StockPanel />;
    case "clientes":
      return <ClientsPanel />;
    case "diretorio":
      return <ClientsDirectory />;
    case "equipe":
      return <TeamsPanel />;
    case "usuarios":
      return <ProfilesPanel />;
    case "rastreamento":
      return <TrackingPanel />;
    case "financeiro":
      return <FinancePanel />;
    case "relatorios":
      return <ReportsPanel />;
    case "auditoria":
      return <AuditPanel />;
    default:
      return null;
  }
}

export default function Home() {
  const hydrated = useHydrated();
  const role = useAppStore((s) => s.role);
  const authLoading = useAuthStore((s) => s.loading);
  const { section, setSection } = useUIStore();

  useEffect(() => {
    if (!canAccessSection(section, role)) {
      setSection(defaultSection(role));
    }
  }, [role, section, setSection]);

  if (!hydrated || authLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="size-7 animate-spin rounded-full border border-white/20 border-t-white/80" />
          <p
            className="text-xs tracking-[0.2em] uppercase"
            style={{ fontFamily: "var(--font-mono)", color: "var(--color-muted)" }}
          >
            Carregando...
          </p>
        </div>
      </div>
    );
  }

  if (role === "tecnico") {
    return (
      <div className="grid min-h-screen place-items-center bg-black px-5">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center gap-5 text-center max-w-xs"
        >
          <div className="size-12 rounded-[var(--radius-md)] border border-white/10 bg-white/[0.06] grid place-items-center">
            <Smartphone className="size-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Acesso pelo App do Técnico</h2>
            <p className="mt-1.5 text-sm" style={{ color: "var(--color-muted)" }}>
              Sua conta é do tipo técnico. Use o app mobile para acessar suas ordens de serviço.
            </p>
          </div>
          <Link
            href="/tecnico-mobile"
            className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] bg-white px-5 py-2.5 text-sm font-semibold text-black transition-all hover:bg-[#E8E8E8] active:scale-[0.97]"
          >
            <Smartphone className="size-4" /> Abrir App do Técnico
          </Link>
        </motion.div>
      </div>
    );
  }

  const current = canAccessSection(section, role) ? section : defaultSection(role);

  return (
    <div className="relative flex min-h-screen bg-black text-white">

      <Sidebar />
      <MobileSidebar />

      <main className="relative flex min-w-0 flex-1 flex-col">
        <Topbar />

        <div className="flex-1 overflow-y-auto p-4 pb-24 lg:p-6 lg:pb-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              <SectionView section={current} />
            </motion.div>
          </AnimatePresence>
        </div>

        <Link
          href="/tecnico"
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-[var(--radius-md)] border px-4 py-3 text-xs font-semibold text-white transition-all hover:bg-white/8 lg:hidden"
          style={{ background: "var(--color-surface-2)", borderColor: "var(--color-line-strong)" }}
        >
          <Smartphone className="size-4" /> App do técnico
        </Link>
      </main>

      <NewOsDialog />
      <ScheduleDialog />
      <TeamLoginDialog />
    </div>
  );
}
