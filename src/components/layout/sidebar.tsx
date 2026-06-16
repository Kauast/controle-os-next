"use client";

import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardList,
  DollarSign,
  Home,
  MapPin,
  Package,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import Image from "next/image";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { canAccessSection, type SectionKey } from "@/lib/access";
import { useAppStore } from "@/store/use-app-store";
import { useUIStore } from "@/store/use-ui-store";

interface NavItem {
  key: SectionKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Operação",
    items: [
      { key: "painel",  label: "Dashboard", icon: Home },
      { key: "agenda",  label: "Agenda",    icon: CalendarDays },
      { key: "ordens",  label: "OS",        icon: ClipboardList },
    ],
  },
  {
    label: "Pessoas",
    items: [
      { key: "clientes",  label: "Clientes",  icon: Users },
      { key: "diretorio", label: "Diretório", icon: BookOpen },
      { key: "equipe",    label: "Equipe",    icon: ShieldCheck },
      { key: "usuarios",  label: "Usuários",  icon: UserCog },
    ],
  },
  {
    label: "Materiais",
    items: [
      { key: "estoque", label: "Estoque", icon: Package },
    ],
  },
  {
    label: "Monitoramento",
    items: [
      { key: "rastreamento", label: "Localização", icon: MapPin },
    ],
  },
  {
    label: "Gestão",
    items: [
      { key: "financeiro", label: "Financeiro", icon: DollarSign },
      { key: "relatorios", label: "Relatórios", icon: BarChart3 },
    ],
  },
];

const roleLabel: Record<string, string> = {
  admin:       "Administrador",
  atendimento: "Atendimento",
  estoque:     "Almoxarife",
  tecnico:     "Técnico",
  financeiro:  "Financeiro",
};

interface SidebarNavProps {
  section: SectionKey;
  role: string;
  onNavigate: (key: SectionKey) => void;
}

export function SidebarNav({ section, role, onNavigate }: SidebarNavProps) {
  return (
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto scrollbar-none" aria-label="Navegação principal">
      {navGroups.map((group) => {
        const visible = group.items.filter((item) => canAccessSection(item.key, role as Parameters<typeof canAccessSection>[1]));
        if (visible.length === 0) return null;

        return (
          <div key={group.label} className="flex flex-col gap-0.5">
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted/60">
              {group.label}
            </p>
            {visible.map((item) => {
              const isActive = section === item.key;
              const Icon = item.icon;

              return (
                <button
                  key={item.key}
                  onClick={() => onNavigate(item.key)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2.5 text-left text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30",
                    isActive
                      ? "bg-white text-black"
                      : "text-muted hover:bg-white/[0.06] hover:text-white",
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-0 -z-10 rounded-[var(--radius-md)] bg-white"
                      transition={{ type: "spring", stiffness: 500, damping: 38 }}
                    />
                  )}
                  <Icon className={cn("size-[15px] shrink-0", isActive ? "text-black" : "text-muted")} aria-hidden="true" />
                  {item.label}
                </button>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  const role = useAppStore((s) => s.role);
  const { section, setSection } = useUIStore();

  return (
    <aside className="hidden w-60 shrink-0 flex-col gap-6 border-r p-4 lg:flex" style={{ borderColor: "var(--color-line)", background: "var(--color-surface-0)" }}>
      <div className="flex items-center gap-3 px-1">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-white/10 bg-white/[0.06]">
          <Image src="/logo.svg" alt="RB Segurança" width={24} height={24} className="rounded-sm" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold tracking-[0.06em] text-white">RB</p>
          <p className="text-[9px] font-medium uppercase tracking-[0.28em]" style={{ fontFamily: "var(--font-mono)", color: "var(--color-muted)" }}>Segurança</p>
        </div>
      </div>

      <SidebarNav
        section={section}
        role={role}
        onNavigate={(key) => setSection(key, null)}
      />

      <div className="rounded-[var(--radius-md)] border p-3" style={{ borderColor: "var(--color-line)", background: "var(--color-surface-2)" }}>
        <p className="text-[9px] font-medium uppercase tracking-[0.2em]" style={{ fontFamily: "var(--font-mono)", color: "var(--color-disabled)" }}>Perfil ativo</p>
        <p className="mt-1 text-sm font-semibold text-white">{roleLabel[role] ?? role}</p>
      </div>
    </aside>
  );
}
