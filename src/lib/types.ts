export type Role = "admin" | "estoque" | "tecnico" | "atendimento";

export type Priority = "normal" | "warning" | "high";
export type OrderStatus = "pending" | "scheduled" | "completed";

export interface ServiceOrder {
  code: string;
  client: string;
  description: string;
  tech: string;
  time: string;
  team: string;
  priority: Priority;
  status: OrderStatus;
  scheduledDate?: string;
  scheduledMonth?: string;
  completedAt?: string;
  _backendId?: string;
}

export interface Product {
  id: number;
  _apiId?: string;
  name: string;
  sku: string;
  category: string;
  location: string;
  qty: number;
  min: number;
  cost: number;
  price: number;
  qr: string;
}

export type MovementType = "entrada" | "saida";

export interface StockMovement {
  id: number;
  product: string;
  type: MovementType;
  qty: number;
  user: string;
  date: string;
  reason: string;
  before: number;
  after: number;
}

export type RequestStatus = "pendente" | "aprovado" | "reprovado";

export interface MaterialRequest {
  id: number;
  os: string;
  name: string;
  qty: number;
  status: RequestStatus;
  when: string;
}

export interface Technician {
  id: number;
  _apiId?: string;
  name: string;
  phone: string;
  status: string;
  team: string;
}

export interface TeamLocation {
  team: string;
  vehicle: string;
  x: number;
  y: number;
  status: string;
  speed: number;
  updated: string;
}

export interface TeamAccount {
  team: string;
  user: string;
  password: string;
  members: string;
}

export interface AuditEntry {
  action: string;
  detail: string;
  when: string;
  role: string;
}

export const TEAMS = [
  "Equipe 1",
  "Equipe 2",
  "Equipe 3",
  "Equipe 4",
  "Equipe 5",
] as const;

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  estoque: "Estoque",
  tecnico: "Tecnico",
  atendimento: "Atendimento",
};
