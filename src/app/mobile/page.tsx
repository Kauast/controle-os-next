"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  ClipboardList,
  Package,
  MapPin,
  UserCircle,
  Wrench,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { roleViewCopy } from "@/lib/access";
import { useAppStore } from "@/store/use-app-store";
import { useHydrated } from "@/hooks/use-hydrated";
import { useState } from "react";

type Tab = "painel" | "os" | "estoque" | "rastreamento" | "perfil";

const statusColor: Record<string, "teal" | "amber" | "red"> = {
  completed: "teal",
  scheduled: "amber",
  pending: "red",
};

const statusLabel: Record<string, string> = {
  completed: "Concluida",
  scheduled: "Agendada",
  pending: "Pendente",
};

export default function MobilePage() {
  const hydrated = useHydrated();
  const role = useAppStore((s) => s.role);
  const orders = useAppStore((s) => s.orders);
  const products = useAppStore((s) => s.products);
  const locations = useAppStore((s) => s.locations);
  const [tab, setTab] = useState<Tab>("painel");

  if (!hydrated) {
    return (
      <div className="grid min-h-screen place-items-center text-muted">Carregando...</div>
    );
  }

  const roleInfo = roleViewCopy[role];
  const pendingOrders = orders.filter((o) => o.status !== "completed");
  const completedOrders = orders.filter((o) => o.status === "completed");
  const lowStock = products.filter((p) => p.qty <= p.min);

  const navItems: { id: Tab; icon: React.ReactNode; label: string; roles?: typeof role[] }[] = [
    { id: "painel", icon: <LayoutDashboard className="size-5" />, label: "Painel" },
    {
      id: "os",
      icon: <ClipboardList className="size-5" />,
      label: "OS",
      roles: ["admin", "atendimento", "tecnico"],
    },
    {
      id: "estoque",
      icon: <Package className="size-5" />,
      label: "Estoque",
      roles: ["admin", "estoque", "tecnico"],
    },
    {
      id: "rastreamento",
      icon: <MapPin className="size-5" />,
      label: "Equipes",
      roles: ["admin", "atendimento"],
    },
    { id: "perfil", icon: <UserCircle className="size-5" />, label: "Perfil" },
  ];

  const visibleNav = navItems.filter((n) => !n.roles || n.roles.includes(role));

  return (
    <div className="mx-auto min-h-screen max-w-md bg-panel pb-24">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-panel/90 px-4 py-3 backdrop-blur">
        <Image src="/logo.svg" alt="Logo" width={36} height={36} className="rounded-[10px]" />
        <div className="flex-1 leading-tight">
          <span className="text-[11px] text-muted">{roleInfo.context}</span>
          <strong className="block text-sm text-ink">{roleInfo.title}</strong>
        </div>
        {role === "tecnico" && (
          <Button variant="secondary" size="sm" asChild>
            <Link href="/tecnico">
              <Wrench className="size-4" /> App tecnico
            </Link>
          </Button>
        )}
      </header>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          className="flex flex-col gap-4 p-4"
        >
          {tab === "painel" && (
            <>
              <section className="grid grid-cols-2 gap-2">
                {[
                  { label: "OS do dia", value: orders.length, color: "text-ink" },
                  { label: "Pendentes", value: pendingOrders.length, color: "text-amber" },
                  { label: "Concluidas", value: completedOrders.length, color: "text-teal" },
                  { label: "Estoque baixo", value: lowStock.length, color: "text-red" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-[12px] border border-line bg-panel-soft/40 p-3 text-center"
                  >
                    <strong className={cn("block text-2xl font-bold", s.color)}>{s.value}</strong>
                    <span className="text-[11px] text-muted">{s.label}</span>
                  </div>
                ))}
              </section>

              <section>
                <strong className="mb-2 block text-sm text-ink">OS recentes</strong>
                <div className="flex flex-col gap-2">
                  {orders.slice(0, 5).map((o) => (
                    <article
                      key={o.code}
                      className="flex items-center gap-3 rounded-[12px] border border-line bg-panel-soft/40 px-3 py-2.5"
                    >
                      <div className="flex-1 min-w-0">
                        <strong className="block truncate text-sm text-ink">{o.code}</strong>
                        <span className="block truncate text-xs text-muted">{o.client}</span>
                      </div>
                      <Badge tone={statusColor[o.status]}>{statusLabel[o.status]}</Badge>
                    </article>
                  ))}
                </div>
              </section>
            </>
          )}

          {tab === "os" && (
            <section>
              <strong className="mb-2 block text-sm text-ink">
                Ordens de servico ({orders.length})
              </strong>
              <div className="flex flex-col gap-2">
                {orders.map((o) => (
                  <article
                    key={o.code}
                    className="rounded-[12px] border border-line bg-panel-soft/40 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <strong className="block text-sm text-ink">{o.code}</strong>
                        <span className="block truncate text-xs text-muted">{o.client}</span>
                        <span className="mt-0.5 block text-xs text-muted">{o.description}</span>
                      </div>
                      <Badge tone={statusColor[o.status]}>{statusLabel[o.status]}</Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" /> {o.time}
                      </span>
                      <span>{o.team}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {tab === "estoque" && (
            <>
              {lowStock.length > 0 && (
                <section>
                  <div className="mb-2 flex items-center gap-2">
                    <AlertTriangle className="size-4 text-amber" />
                    <strong className="text-sm text-ink">Estoque critico ({lowStock.length})</strong>
                  </div>
                  <div className="flex flex-col gap-2">
                    {lowStock.map((p) => (
                      <article
                        key={p.id}
                        className="flex items-center gap-3 rounded-[12px] border border-amber/30 bg-amber-soft/20 px-3 py-2.5"
                      >
                        <div className="flex-1 min-w-0">
                          <strong className="block truncate text-sm text-ink">{p.name}</strong>
                          <span className="text-xs text-muted">{p.category}</span>
                        </div>
                        <span className="rounded-[8px] bg-amber/10 px-2 py-1 text-xs font-semibold text-amber">
                          {p.qty}/{p.min}
                        </span>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <strong className="mb-2 block text-sm text-ink">
                  Todos os produtos ({products.length})
                </strong>
                <div className="flex flex-col gap-2">
                  {products.map((p) => (
                    <article
                      key={p.id}
                      className="flex items-center gap-3 rounded-[12px] border border-line bg-panel-soft/40 px-3 py-2.5"
                    >
                      <div className="flex-1 min-w-0">
                        <strong className="block truncate text-sm text-ink">{p.name}</strong>
                        <span className="text-xs text-muted">{p.sku}</span>
                      </div>
                      <span
                        className={cn(
                          "rounded-[8px] px-2 py-1 text-xs font-semibold",
                          p.qty <= p.min
                            ? "bg-amber/10 text-amber"
                            : "bg-teal-soft/40 text-teal",
                        )}
                      >
                        {p.qty} un
                      </span>
                    </article>
                  ))}
                </div>
              </section>
            </>
          )}

          {tab === "rastreamento" && (
            <section>
              <strong className="mb-2 block text-sm text-ink">
                Equipes ativas ({locations.length})
              </strong>
              {locations.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">Nenhuma equipe ativa.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {locations.map((l) => (
                    <article
                      key={l.team}
                      className="flex items-center gap-3 rounded-[12px] border border-line bg-panel-soft/40 px-3 py-2.5"
                    >
                      <div className="flex-1 min-w-0">
                        <strong className="block text-sm text-ink">{l.team}</strong>
                        <span className="block truncate text-xs text-muted">{l.vehicle} · {l.status}</span>
                      </div>
                      <Badge tone="teal">Ativa</Badge>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {tab === "perfil" && (
            <section className="flex flex-col gap-3">
              <div className="rounded-[14px] border border-line bg-panel-soft/40 p-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-12 place-items-center rounded-full bg-teal/10 text-lg font-bold text-teal">
                    {roleInfo.context[0]}
                  </div>
                  <div>
                    <strong className="block text-sm text-ink">{roleInfo.context}</strong>
                    <span className="text-xs text-muted capitalize">{role}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1 rounded-[14px] border border-line bg-panel-soft/40 p-2">
                {[
                  { label: "Versao do app", value: "1.0.0" },
                  { label: "Plataforma", value: "PWA Mobile" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-[10px] px-3 py-2.5"
                  >
                    <span className="text-sm text-ink">{item.label}</span>
                    <span className="text-sm text-muted">{item.value}</span>
                  </div>
                ))}
              </div>

              <Button variant="secondary" className="w-full" asChild>
                <Link href="/">
                  <ChevronRight className="size-4" /> Acessar painel web
                </Link>
              </Button>
              {role === "tecnico" && (
                <Button className="w-full" asChild>
                  <Link href="/tecnico">
                    <Wrench className="size-4" /> App do tecnico
                  </Link>
                </Button>
              )}
              <div className="flex items-center justify-center gap-1 pt-1">
                <CheckCircle2 className="size-3 text-teal" />
                <span className="text-[11px] text-muted">Instalavel como PWA</span>
              </div>
            </section>
          )}
        </motion.div>
      </AnimatePresence>

      <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2 border-t border-line bg-panel/95 backdrop-blur">
        <div className="flex items-center">
          {visibleNav.map((n) => (
            <button
              key={n.id}
              onClick={() => setTab(n.id)}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors",
                tab === n.id ? "text-teal" : "text-muted",
              )}
            >
              {n.icon}
              {n.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
