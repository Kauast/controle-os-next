import type { Role } from "./types";

export type SectionKey =
  | "painel"
  | "agenda"
  | "ordens"
  | "estoque"
  | "clientes"
  | "diretorio"
  | "equipe"
  | "usuarios"
  | "rastreamento"
  | "financeiro"
  | "relatorios"
  | "auditoria";

const permissions: Record<Role, SectionKey[]> = {
  admin: ["painel", "agenda", "ordens", "estoque", "clientes", "diretorio", "equipe", "usuarios", "rastreamento", "financeiro", "relatorios", "auditoria"],
  atendimento: ["painel", "agenda", "ordens", "clientes", "diretorio", "equipe", "rastreamento", "relatorios"],
  estoque: ["estoque", "relatorios"],
  tecnico: [],
  financeiro: ["financeiro", "relatorios"],
};

export const access = {
  stock:           (r: Role) => permissions[r]?.includes("estoque") ?? false,
  stockWrite:      (r: Role) => r === "admin" || r === "estoque",
  tracking:        (r: Role) => permissions[r]?.includes("rastreamento") ?? false,
  clients:         (r: Role) => permissions[r]?.includes("clientes") ?? false,
  clientsDirectory:(r: Role) => permissions[r]?.includes("diretorio") ?? false,
  reports:         (r: Role) => permissions[r]?.includes("relatorios") ?? false,
  teams:           (r: Role) => permissions[r]?.includes("equipe") ?? false,
  finance:         (r: Role) => permissions[r]?.includes("financeiro") ?? false,
  users:           (r: Role) => permissions[r]?.includes("usuarios") ?? false,
  audit:           (r: Role) => permissions[r]?.includes("auditoria") ?? false,
  seesAllOrders:   (r: Role) => r !== "tecnico",
  canCreateOS:     (r: Role) => r === "admin" || r === "atendimento",
  canDeleteOS:     (r: Role) => r === "admin" || r === "atendimento",
};

export function allowedSections(role: Role): SectionKey[] {
  return permissions[role] ?? [];
}

export function canAccessSection(section: SectionKey, role: Role): boolean {
  return permissions[role]?.includes(section) ?? false;
}

export function defaultSection(role: Role): SectionKey {
  if (role === "estoque") return "estoque";
  if (role === "financeiro") return "financeiro";
  return "painel";
}

export const roleViewCopy: Record<Role, { context: string; title: string }> = {
  admin:       { context: "Gestao geral",  title: "Dashboard" },
  atendimento: { context: "Atendimento",   title: "Agenda e OS" },
  estoque:     { context: "Almoxarifado",  title: "Estoque" },
  tecnico:     { context: "Tecnico",       title: "Minhas OS" },
  financeiro:  { context: "Financeiro",    title: "Financeiro" },
};
