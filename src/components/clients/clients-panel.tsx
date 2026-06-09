"use client";

import { Card, SectionHeading } from "@/components/ui/card";

export function ClientsPanel() {
  return (
    <Card>
      <SectionHeading eyebrow="Clientes" title="Historico do cliente" />
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted">
        <p className="text-sm">Nenhum cliente selecionado.</p>
        <p className="mt-1 text-xs">Selecione um cliente para ver o historico de ordens de servico.</p>
      </div>
    </Card>
  );
}
