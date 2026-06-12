"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Smartphone } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Metrics } from "@/components/dashboard/metrics";
import { AgendaPanel } from "@/components/dashboard/agenda-panel";
import { DispatchBoard } from "@/components/dashboard/dispatch-board";
import { OrderQueue } from "@/components/dashboard/order-queue";
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
import { canAccessSection, defaultSection, type SectionKey } from "@/lib/access";
import { useAppStore } from "@/store/use-app-store";
import { useUIStore } from "@/store/use-ui-store";
import { useHydrated } from "@/hooks/use-hydrated";

function SectionView({ section }: { section: SectionKey }) {
  switch (section) {
    case "painel":
      return (
        <div className="flex flex-col gap-4">
          <Metrics />
          <DispatchBoard />
          <OrderQueue />
        </div>
      );
    case "agenda":
      return (
        <div className="flex flex-col gap-4">
          <AgendaPanel />
          <DispatchBoard />
        </div>
      );
    case "ordens":
      return <OrderQueue />;
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
      return (
        <div className="rounded-2xl border border-white/10 bg-[#101010] p-6">
          <h2 className="text-lg font-bold text-white">Auditoria</h2>
          <p className="mt-2 text-sm text-zinc-400">Log de acoes do sistema. Em breve.</p>
        </div>
      );
    default:
      return null;
  }
}

export default function Home() {
  const hydrated = useHydrated();
  const role = useAppStore((s) => s.role);
  const { section, setSection } = useUIStore();

  useEffect(() => {
    if (!canAccessSection(section, role)) {
      setSection(defaultSection(role));
    }
  }, [role, section, setSection]);

  if (!hydrated) {
    return (
      <div className="grid min-h-screen place-items-center bg-black text-zinc-400">
        Carregando...
      </div>
    );
  }

  const current = canAccessSection(section, role) ? section : defaultSection(role);

  return (
    <div className="relative flex min-h-screen bg-black text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.04),transparent_25%)]" />
      <Sidebar />
      <main className="relative flex min-w-0 flex-1 flex-col">
        <Topbar />
        <div className="flex-1 overflow-y-auto p-4 pb-24 lg:p-7 lg:pb-7">
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <SectionView section={current} />
            </motion.div>
          </AnimatePresence>
        </div>

        <Link
          href="/tecnico"
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black shadow-lg transition hover:bg-zinc-100 lg:hidden"
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
