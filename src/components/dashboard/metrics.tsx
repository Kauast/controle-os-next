"use client";

import { motion } from "framer-motion";
import { access } from "@/lib/access";
import { TEAMS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/use-app-store";
import { useProducts } from "@/hooks/useProducts";
import { useTechnicians } from "@/hooks/useTechnicians";
import { useServiceOrders } from "@/hooks/useServiceOrders";

export function Metrics() {
  const role = useAppStore((s) => s.role);

  const { data: osData } = useServiceOrders({ limit: 200 });
  const apiOrders = osData?.serviceOrders ?? [];
  const { data: products = [] } = useProducts();
  const { data: technicians = [] } = useTechnicians();

  const emAndamento = apiOrders.filter((o) => o.status === "OPEN" || o.status === "IN_PROGRESS" || o.status === "WAITING_PARTS").length;
  const atrasadas = apiOrders.filter((o) => o.priority === "HIGH" && (o.status === "OPEN" || o.status === "IN_PROGRESS")).length;
  const disponiveis = TEAMS.filter((team) => {
    const techs = technicians.filter((t) => t.team === team);
    const busy = techs.find((t) => t.status && t.status !== "Disponivel");
    return !busy;
  }).length;
  const critico = products.filter((p) => p.qty <= p.min && p.min > 0).length;

  const cards = [
    { label: "OS em andamento", value: emAndamento, hint: `${atrasadas} com prioridade alta`, alert: false },
    { label: "OS atrasadas", value: atrasadas, hint: "Com prioridade alta em aberto", alert: atrasadas > 0 },
    { label: "Equipes disponiveis", value: disponiveis, hint: "Em plantao", alert: false },
    ...(access.stock(role)
      ? [{ label: "Estoque critico", value: critico, hint: "Itens abaixo do minimo", alert: critico > 0 }]
      : []),
  ];

  return (
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {cards.map((card, i) => (
        <motion.article
          key={card.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className={cn(
            "rounded-[16px] border border-line bg-panel p-4 shadow-[var(--shadow-panel)]",
            card.alert && "border-red/40 bg-red-soft/40",
          )}
        >
          <span className="text-xs font-medium text-muted">{card.label}</span>
          <strong className={cn("mt-1 block text-3xl font-bold text-ink", card.alert && "text-red")}>
            {card.value}
          </strong>
          <small className="text-xs text-muted">{card.hint}</small>
        </motion.article>
      ))}
    </section>
  );
}
