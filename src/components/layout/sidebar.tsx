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
import { motion, AnimatePresence } from "framer-motion";
import { cn, userInitials } from "@/lib/utils";
import { canAccessSection, type SectionKey } from "@/lib/access";
import { useAppStore } from "@/store/use-app-store";
import { useAuthStore } from "@/store/use-auth-store";
import { useUIStore } from "@/store/use-ui-store";
import { LionShield } from "./LionShield";
import { ROLE_LABELS } from "@/lib/types";

interface NavItem {
  key: SectionKey;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
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
  const { section, stockTarget, setSection } = useUIStore();
  const user = useAuthStore((s) => s.user);
  const initials = userInitials(user?.email, role.slice(0, 2).toUpperCase());

  return (
    <>
      {/* Brand header */}
      <div className="px-8 py-7 flex flex-col items-center gap-3 border-b border-white/5 shrink-0">
        <LionShield className="size-12 text-silver" />
        <div className="text-center">
          <div className="text-[11px] font-semibold tracking-[0.28em] text-silver">GUARDIÃO</div>
          <div className="font-mono-tabular text-[9px] uppercase tracking-[0.22em] text-silver-muted mt-1">
            Service Ops
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 space-y-4 overflow-y-auto scrollbar-none">
        {groups.map((group, gi) => {
          const visible = group.items.filter((item) => canAccessSection(item.key, role));
          if (visible.length === 0) return null;
          return (
            <div key={gi} className="flex flex-col gap-0.5">
              {group.label && (
                <span className="px-3 mb-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-silver-muted/60">
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
                      "relative flex items-center gap-3 px-3 py-2 text-[13px] rounded-sm transition-colors text-left w-full",
                      isActive
                        ? "text-amber bg-amber/[0.12]"
                        : "text-silver-muted hover:text-silver hover:bg-white/[0.03]",
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-amber rounded-full" />
                    )}
                    <Icon className="size-4 shrink-0" strokeWidth={1.5} />
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-5 py-5 border-t border-white/5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-sm bg-steel grid place-items-center text-[10px] font-mono-tabular text-silver shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium text-silver truncate">
              {user?.email ?? ROLE_LABELS[role]}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-silver-muted">
              {ROLE_LABELS[role]}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-[260px] shrink-0 flex-col bg-onyx text-silver sticky top-0 h-screen lg:flex">
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
            className="fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col bg-onyx text-silver shadow-xl lg:hidden"
          >
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="absolute right-3 top-3 rounded-full p-2 text-silver-muted hover:text-silver"
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
