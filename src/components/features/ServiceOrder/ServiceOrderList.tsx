"use client";

import { useServiceOrders, useUpdateServiceOrderStatus } from "@/hooks/useServiceOrders";

export function ServiceOrderList() {
  const { data, isLoading, isError } = useServiceOrders({ page: 1 });
  const updateStatus = useUpdateServiceOrderStatus();

  if (isLoading) return <p className="p-4 text-muted-foreground">Carregando OS...</p>;
  if (isError) return <p className="p-4 text-destructive">Erro ao carregar ordens de serviço.</p>;

  return (
    <ul className="divide-y">
      {data?.serviceOrders.map((os) => (
        <li key={os.id} className="flex items-center justify-between p-4">
          <span className="font-medium">{os.id}</span>
          <span className="text-sm text-muted-foreground">{os.status}</span>
          <button
            className="text-sm underline"
            onClick={() => updateStatus.mutate({ id: os.id, status: "concluido" })}
            disabled={updateStatus.isPending}
          >
            Concluir
          </button>
        </li>
      ))}
    </ul>
  );
}
