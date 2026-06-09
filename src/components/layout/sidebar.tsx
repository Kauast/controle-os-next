"use client";

import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  DollarSign,
  LayoutDashboard,
  MapPin,
  Package,
  UserCog,
  Users,
  X,
} from "lucide-react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { canAccessSection, type SectionKey } from "@/lib/access";
import { useAppStore } from "@/store/use-app-store";
import { useUIStore } from "@/store/use-ui-store";

interface NavItem {
  key: SectionKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  stockTarget?: string;
}

const groups: { label?: string; items: NavItem[] }[] = [
  { items: [{ key: "painel", label: "Painel", icon: LayoutDashboard }] },
  {
    label: "Operacao",
    items: [
      { key: "agenda", label: "Agenda", icon: CalendarDays },
      { key: "ordens", label: "Ordens", icon: ClipboardList },
      { key: "equipe", label: "Equipes", icon: UserCog },
      { key: "rastreamento", label: "Localizacao", icon: MapPin },
    ],
  },
  {
    label: "Estoque",
    items: [
      { key: "estoque", label: "Produtos", icon: Package, stockTarget: "stock-produtos" },
      { key: "estoque", label: "Solicitacoes", icon: Package, stockTarget: "stock-solicitacoes" },
      { key: "estoque", label: "Entrada e Saida", icon: Package, stockTarget: "stock-movimento" },
      { key: "estoque", label: "Historico", icon: Package, stockTarget: "stock-historico" },
    ],
  },
  {
    label: "Administracao",
    items: [
      { key: "clientes", label: "Clientes", icon: Users },
      { key: "usuarios", label: "Usuarios", icon: UserCog },
      { key: "financeiro", label: "Financeiro", icon: DollarSign },
      { key: "relatorios", label: "Relatorios", icon: BarChart3 },
    ],
  },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const role = useAppStore((s) => s.role);
  const orders = useAppStore((s) => s.orders);
  const { section, stockTarget, setSection } = useUIStore();

  const open = orders.filter((o) => o.status !== "completed").length;
  const done = orders.filter((o) => o.status === "completed").length;

  return (
    <>
      <div className="flex items-center gap-3 px-5 py-5">
        <Image src="/logo.svg" alt="Logo" width={44} height={44} className="rounded-[12px]" />
        <div className="leading-tight">
          <strong className="block text-sm text-ink">Controle OS</strong>
          <span className="text-xs text-muted">Agenda e estoque</span>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 scrollbar-none">
        {groups.map((group, gi) => {
          const visible = group.items.filter((item) => canAccessSection(item.key, role));
          if (visible.length === 0) return null;
          return (
            <div key={gi} className="flex flex-col gap-1">
              {group.label && (
                <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted/70">
                  {group.label}
                </span>
              )}
              {visible.map((item) => {
                const isActive = item.stockTarget
                  ? section === "estoque" && stockTarget === item.stockTarget
                  : section === item.key && !stockTarget;
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    onClick={() => {
                      setSection(item.key, item.stockTarget ?? null);
                      onNavigate?.();
                    }}
                    className={cn(
                      "relative flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-sm font-medium text-muted transition-colors hover:text-ink",
                      isActive && "text-teal",
                    )}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="nav-active"
                        className="absolute inset-0 -z-10 rounded-[10px] bg-teal-soft"
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      />
                    )}
                    <Icon className="size-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="mx-5 mb-5 rounded-[14px] border border-line bg-panel-soft p-3.5">
        <span className="text-[10px] uppercase tracking-wide text-muted">Plantao do dia</span>
        <strong className="mt-1 block text-sm text-ink">Equipes em campo</strong>
        <small className="text-xs text-muted">
          {open} OS abertas, {done} concluidas
        </small>
      </div>
    </>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-[260px] shrink-0 flex-col gap-6 border-r border-line bg-panel/80 lg:flex">
      <SidebarContent />
    </aside>
  );
}

export function MobileSidebar() {
  const { mobileSidebarOpen, setMobileSidebarOpen } = useUIStore();

  return (
    <AnimatePresence>
      {mobileSidebarOpen && (
        <>
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <motion.aside
            key="drawer"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
            className="fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-line bg-panel shadow-xl lg:hidden"
          >
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="absolute right-3 top-3 rounded-full p-2 text-muted hover:text-ink"
              aria-label="Fechar menu"
            >
              <X className="size-5" />
            </button>
            <SidebarContent onNavigate={() => setMobileSidebarOpen(false)} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
