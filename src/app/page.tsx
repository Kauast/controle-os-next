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
      <div className="grid min-h-screen place-items-center bg-dark text-muted">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-2 border-teal border-t-transparent" />
          <p className="text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (role === "tecnico") {
    return (
      <div className="grid min-h-screen place-items-center bg-dark px-5">
        <div className="flex flex-col items-center gap-4 text-center max-w-xs">
          <div className="size-12 rounded-full bg-teal/10 grid place-items-center">
            <Smartphone className="size-6 text-teal" />
          </div>
          <h2 className="text-lg font-bold text-ink">Acesso pelo App do Técnico</h2>
          <p className="text-sm text-muted">Sua conta é do tipo técnico. Use o app mobile para acessar suas ordens de serviço.</p>
          <Link href="/tecnico-mobile" className="inline-flex items-center gap-2 rounded-xl bg-teal px-5 py-2.5 text-sm font-semibold text-dark transition hover:bg-teal/90">
            <Smartphone className="size-4" /> Abrir App do Técnico
          </Link>
        </div>
      </div>
    );
  }

  const current = canAccessSection(section, role) ? section : defaultSection(role);

  return (
    <div className="relative flex min-h-screen bg-dark text-ink">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.04),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(20,184,166,0.02),transparent_30%)]" />

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
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-xl bg-panel px-4 py-3 text-sm font-semibold text-ink shadow-lg border border-line transition hover:bg-panel-soft lg:hidden"
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
