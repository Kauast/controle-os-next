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
