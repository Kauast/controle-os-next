"use client";

import { motion } from "framer-motion";
import { Card, SectionHeading } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { orderTone, sortOrders, toneBorder } from "@/lib/orders";
import { cn } from "@/lib/utils";
import { useVisibleOrders } from "@/hooks/use-visible-orders";

export function OrderQueue() {
  const orders = sortOrders(useVisibleOrders().filter((o) => o.team !== "Sem equipe"));

  return (
    <Card>
      <SectionHeading eyebrow="Hoje" title="Fila de OS">
        <Button variant="ghost" size="sm">
          Ver todas
        </Button>
      </SectionHeading>

      <div className="flex flex-col gap-2">
        {orders.map((o, i) => (
          <motion.article
            key={o.code}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            className={cn(
              "grid grid-cols-[56px_1fr] items-center gap-2 rounded-[12px] border border-line bg-panel-soft/40 p-3 sm:grid-cols-[64px_1fr_auto] sm:gap-3",
              toneBorder[orderTone(o)],
            )}
          >
            <div className="text-sm font-bold text-teal">{o.code}</div>
            <div className="min-w-0">
              <strong className="block truncate text-sm text-ink">{o.client}</strong>
              <span className="block truncate text-xs text-muted">{o.description}</span>
              <small className="block truncate text-xs text-muted sm:hidden">
                {o.tech || o.team} · {o.time}
              </small>
            </div>
            <small className="hidden whitespace-nowrap text-xs text-muted sm:block">
              {o.tech || o.team} · {o.time}
            </small>
          </motion.article>
        ))}
        {orders.length === 0 && (
          <p className="py-6 text-center text-sm text-muted">Nenhuma OS na fila.</p>
        )}
      </div>
    </Card>
  );
}
