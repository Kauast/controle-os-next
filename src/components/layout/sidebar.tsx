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
                    "relative flex items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-left text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/50",
                    isActive
                      ? "bg-teal text-black shadow-sm"
                      : "text-muted hover:bg-white/8 hover:text-ink",
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-0 -z-10 rounded-[12px] bg-teal"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
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
    <aside className="hidden w-64 shrink-0 flex-col gap-6 border-r border-line bg-panel-soft p-4 lg:flex">
      <div className="flex items-center gap-3 px-1">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
          <Image src="/logo.svg" alt="RB Segurança" width={28} height={28} className="rounded-lg" />
        </div>
        <div className="leading-tight">
          <p className="text-base font-black tracking-tight text-ink">RB</p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted">Segurança</p>
        </div>
      </div>

      <SidebarNav
        section={section}
        role={role}
        onNavigate={(key) => setSection(key, null)}
      />

      <div className="rounded-[12px] border border-line bg-panel/60 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted/60">Perfil ativo</p>
        <p className="mt-0.5 text-sm font-semibold text-ink">{roleLabel[role] ?? role}</p>
      </div>
    </aside>
  );
}
