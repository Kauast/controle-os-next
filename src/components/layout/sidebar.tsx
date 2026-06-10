"use client";

import {
  BarChart3,
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
  stockTarget?: string;
}

const navItems: NavItem[] = [
  { key: "painel", label: "Inicio", icon: Home },
  { key: "agenda", label: "Agenda", icon: CalendarDays },
  { key: "ordens", label: "OS", icon: ClipboardList },
  { key: "estoque", label: "Estoque", icon: Package },
  { key: "clientes", label: "Clientes", icon: Users },
  { key: "diretorio", label: "Diretorio", icon: Users },
  { key: "equipe", label: "Equipe", icon: ShieldCheck },
  { key: "usuarios", label: "Usuarios", icon: UserCog },
  { key: "rastreamento", label: "Localizacao", icon: MapPin },
  { key: "financeiro", label: "Financeiro", icon: DollarSign },
  { key: "relatorios", label: "Relatorios", icon: BarChart3 },
];

const roleLabel: Record<string, string> = {
  admin: "Administrador",
  atendimento: "Atendimento",
  estoque: "Almoxarife",
  tecnico: "Tecnico",
  financeiro: "Financeiro",
};

export function Sidebar() {
  const role = useAppStore((s) => s.role);
  const { section, setSection } = useUIStore();

  const visible = navItems.filter((item) => canAccessSection(item.key, role));

  return (
    <aside className="hidden w-72 shrink-0 flex-col gap-6 border-r border-white/10 bg-black p-5 lg:flex">
      <div className="flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-white">
          <Image src="/logo.svg" alt="RB" width={32} height={32} className="rounded-xl" />
        </div>
        <div className="leading-tight">
          <p className="text-xl font-black tracking-tight text-white">RB</p>
          <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">Seguranca</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto scrollbar-none">
        {visible.map((item) => {
          const isActive = section === item.key;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => setSection(item.key, null)}
              className={cn(
                "relative flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition-colors",
                isActive
                  ? "bg-white text-black font-semibold"
                  : "text-zinc-300 hover:bg-white/10 hover:text-white"
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 -z-10 rounded-2xl bg-white"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <Icon className="size-4 shrink-0" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="rounded-2xl border border-white/10 bg-[#101010] p-4">
        <p className="text-xs text-zinc-500">Perfil ativo</p>
        <p className="mt-1 font-semibold text-white">{roleLabel[role] ?? role}</p>
      </div>
    </aside>
  );
}
