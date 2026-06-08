import type { Role } from "./types";

export type SectionKey =
  | "painel"
  | "agenda"
  | "ordens"
  | "estoque"
  | "clientes"
  | "equipe"
  | "usuarios"
  | "rastreamento"
  | "financeiro"
  | "relatorios";

export const access = {
  stock: (r: Role) => r === "admin" || r === "estoque" || r === "tecnico",
  stockWrite: (r: Role) => r === "admin" || r === "estoque",
  tracking: (r: Role) => r === "admin" || r === "atendimento",
  clients: (r: Role) => r === "admin" || r === "atendimento",
  reports: (r: Role) => r === "admin" || r === "atendimento",
  teams: (r: Role) => r === "admin" || r === "atendimento",
  finance: (r: Role) => r === "admin",
  users: (r: Role) => r === "admin",
  seesAllOrders: (r: Role) => r !== "tecnico",
};

export function canAccessSection(section: SectionKey, role: Role): boolean {
  switch (section) {
    case "painel":
    case "agenda":
    case "ordens":
      return role !== "estoque";
    case "estoque":
      return access.stock(role);
    case "clientes":
      return access.clients(role);
    case "equipe":
      return access.teams(role);
    case "usuarios":
      return access.users(role);
    case "rastreamento":
      return access.tracking(role);
    case "financeiro":
      return access.finance(role);
    case "relatorios":
      return access.reports(role);
    default:
      return true;
  }
}

export function defaultSection(role: Role): SectionKey {
  return role === "estoque" ? "estoque" : "painel";
}

export const roleViewCopy: Record<Role, { context: string; title: string }> = {
  admin: { context: "Gestao geral", title: "Visao do dia" },
  atendimento: { context: "Atendimento", title: "Agenda e OS" },
  estoque: { context: "Almoxarifado", title: "Estoque" },
  tecnico: { context: "Tecnico", title: "Minhas OS" },
};
