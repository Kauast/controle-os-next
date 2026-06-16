/**
 * Limite padrão de service orders buscados por página em listagens gerais.
 * Usar este valor garante que todos os componentes compartilhem o mesmo cache
 * da TanStack Query (mesma queryKey).
 */
export const SERVICE_ORDERS_PAGE_LIMIT = 200;

export const STATUS_DOT: Record<string, string> = {
  "Em atendimento": "bg-teal",
  "A caminho": "bg-amber",
  "Em rota": "bg-teal",
  Agendada: "bg-amber",
  Disponivel: "bg-teal",
};

export function statusTone(status: string): "teal" | "amber" | "red" {
  const s = status.toLowerCase();
  if (s.includes("offline")) return "red";
  if (s.includes("caminho") || s.includes("rota") || s.includes("agendada")) return "amber";
  return "teal";
}
