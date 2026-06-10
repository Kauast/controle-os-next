import type { Role } from "./types";

export interface AuthUser {
  id: string;
  name?: string;
  email: string;
  role: string;
}

export function backendRoleToFrontend(backendRole: string): Role {
  const map: Record<string, Role> = {
    ADMIN:      "admin",
    STOCK:      "estoque",
    TECHNICIAN: "tecnico",
    ATTENDANT:  "atendimento",
    FINANCIAL:  "financeiro",
  };
  return map[backendRole] ?? "atendimento";
}

export function decodeJwtPayload(token: string): AuthUser | null {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    return JSON.parse(json) as AuthUser;
  } catch {
    return null;
  }
}
