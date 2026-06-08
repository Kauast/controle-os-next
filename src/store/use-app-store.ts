"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  seedLocations,
  seedMovements,
  seedOrders,
  seedProducts,
  seedRequests,
  seedTeamAccounts,
  seedTechnicians,
} from "@/lib/seed";
import type {
  AuditEntry,
  MaterialRequest,
  Product,
  Role,
  ServiceOrder,
  StockMovement,
  TeamLocation,
  Technician,
} from "@/lib/types";
import { nowLabel } from "@/lib/utils";

interface AppState {
  role: Role;
  activeTeam: string;
  activeTeamAccount: { team: string; user: string; members: string } | null;

  orders: ServiceOrder[];
  products: Product[];
  movements: StockMovement[];
  requests: MaterialRequest[];
  technicians: Technician[];
  locations: TeamLocation[];
  audit: AuditEntry[];

  // technician execution (single active OS demo: OS-1048)
  checkinDone: boolean;
  photos: Record<string, string>;
  signature: string | null;
  chipId: string | null;

  setRole: (role: Role) => void;
  setActiveTeam: (team: string) => void;
  loginTeam: (team: string) => void;
  logoutTeam: () => void;

  addAudit: (action: string, detail: string) => void;

  addOrder: (order: ServiceOrder) => void;
  assignOrder: (code: string, team: string) => void;
  completeOrder: (code: string) => void;
  nextOrderCode: () => string;

  addProduct: (p: Omit<Product, "id" | "qr">) => void;
  registerMovement: (args: {
    identifier: string;
    type: StockMovement["type"];
    qty: number;
    reason: string;
  }) => boolean;

  createRequest: (item: { name: string; qty: number }) => void;
  reviewRequest: (id: number, status: "aprovado" | "reprovado") => void;

  saveTechnician: (tech: Omit<Technician, "id"> & { id?: number }) => number;
  deleteTechnician: (id: number) => void;

  refreshLocations: () => void;

  setCheckin: () => void;
  savePhoto: (slot: string, dataUrl: string) => void;
  saveSignature: (dataUrl: string) => void;
  clearSignature: () => void;
  verifyChip: (id: string) => void;
}

export const teamAccounts = seedTeamAccounts;

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      role: "admin",
      activeTeam: "Equipe 1",
      activeTeamAccount: null,

      orders: seedOrders,
      products: seedProducts,
      movements: seedMovements,
      requests: seedRequests,
      technicians: seedTechnicians,
      locations: seedLocations,
      audit: [],

      checkinDone: false,
      photos: { "1": "captured", "2": "captured" },
      signature: null,
      chipId: null,

      setRole: (role) => {
        set({ role });
        if (role !== "tecnico") set({ activeTeamAccount: null });
        get().addAudit("Perfil alterado", `Perfil ativo: ${role}`);
      },

      setActiveTeam: (team) => set({ activeTeam: team }),

      loginTeam: (team) => {
        const account = teamAccounts.find((a) => a.team === team) ?? teamAccounts[0];
        set({
          role: "tecnico",
          activeTeam: account.team,
          activeTeamAccount: { team: account.team, user: account.user, members: account.members },
        });
        get().addAudit("Conta de equipe acessada", `${account.team} entrou como ${account.user}`);
      },

      logoutTeam: () => set({ activeTeamAccount: null, role: "admin" }),

      addAudit: (action, detail) =>
        set((s) => ({
          audit: [{ action, detail, when: nowLabel(), role: s.role }, ...s.audit].slice(0, 80),
        })),

      addOrder: (order) => {
        set((s) => ({ orders: [...s.orders, order] }));
        get().addAudit("OS criada", `${order.code} - ${order.client} - ${order.team}`);
      },

      assignOrder: (code, team) =>
        set((s) => ({
          orders: s.orders.map((o) => (o.code === code ? { ...o, team } : o)),
        })),

      completeOrder: (code) => {
        set((s) => ({
          orders: s.orders.map((o) =>
            o.code === code ? { ...o, status: "completed", completedAt: nowLabel() } : o,
          ),
        }));
        get().addAudit("OS concluida", `${code} finalizada com fotos, assinatura e ID do chip`);
      },

      nextOrderCode: () => {
        const highest = get().orders.reduce((max, o) => {
          const n = Number(o.code.replace(/\D/g, ""));
          return Number.isFinite(n) ? Math.max(max, n) : max;
        }, 0);
        return `OS-${highest + 1}`;
      },

      addProduct: (p) => {
        set((s) => {
          const id = Math.max(0, ...s.products.map((i) => i.id)) + 1;
          const sku = p.sku.toUpperCase();
          return { products: [...s.products, { ...p, id, sku, qr: `PROD:${sku}` }] };
        });
        get().addAudit("Produto cadastrado", `${p.name} (${p.sku})`);
      },

      registerMovement: ({ identifier, type, qty, reason }) => {
        const norm = identifier.trim().toLowerCase();
        const product = get().products.find(
          (p) =>
            String(p.id) === norm ||
            p.sku.toLowerCase() === norm ||
            p.qr.toLowerCase() === norm,
        );
        if (!product) return false;
        const before = product.qty;
        const after = type === "entrada" ? before + qty : before - qty;
        if (after < 0) return false;

        set((s) => ({
          products: s.products.map((p) => (p.id === product.id ? { ...p, qty: after } : p)),
          movements: [
            {
              id: Date.now(),
              product: product.name,
              type,
              qty,
              user: "Estoque",
              date: nowLabel(),
              reason,
              before,
              after,
            },
            ...s.movements,
          ],
        }));
        get().addAudit(
          type === "entrada" ? "Entrada de estoque" : "Saida de estoque",
          `${qty} un. de ${product.name} - ${reason}`,
        );
        return true;
      },

      createRequest: (item) => {
        const request: MaterialRequest = {
          id: Date.now(),
          os: "OS-1048",
          name: item.name,
          qty: item.qty,
          status: "pendente",
          when: nowLabel(),
        };
        set((s) => ({ requests: [request, ...s.requests] }));
        get().addAudit("Material solicitado", `${item.qty}x ${item.name} para OS-1048`);
      },

      reviewRequest: (id, status) => {
        set((s) => ({
          requests: s.requests.map((r) => (r.id === id ? { ...r, status } : r)),
        }));
        const req = get().requests.find((r) => r.id === id);
        if (req) get().addAudit(`Material ${status}`, `${req.qty}x ${req.name} em ${req.os}`);
      },

      saveTechnician: (tech) => {
        let id = tech.id ?? 0;
        set((s) => {
          if (tech.id) {
            return {
              technicians: s.technicians.map((t) =>
                t.id === tech.id ? { ...t, ...tech, id: tech.id! } : t,
              ),
            };
          }
          id = Math.max(0, ...s.technicians.map((t) => t.id)) + 1;
          return { technicians: [...s.technicians, { ...tech, id }] };
        });
        get().addAudit("Tecnico salvo", `${tech.name} - ${tech.team} - ${tech.status}`);
        return id;
      },

      deleteTechnician: (id) => {
        set((s) => ({ technicians: s.technicians.filter((t) => t.id !== id) }));
        get().addAudit("Tecnico excluido", "Cadastro removido localmente");
      },

      refreshLocations: () => {
        const time = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        set((s) => ({
          locations: s.locations.map((l) => {
            const moving = l.status !== "Disponivel";
            return {
              ...l,
              x: Math.min(88, Math.max(8, l.x + Math.floor(Math.random() * 9) - 4)),
              y: Math.min(82, Math.max(14, l.y + Math.floor(Math.random() * 9) - 4)),
              speed: moving ? Math.max(0, l.speed + Math.floor(Math.random() * 13) - 6) : 0,
              updated: time,
            };
          }),
        }));
        get().addAudit("Rastreamento atualizado", "Posicoes locais das equipes atualizadas");
      },

      setCheckin: () => {
        set({ checkinDone: true });
        get().addAudit("Check-in registrado", "Atendimento iniciado");
      },

      savePhoto: (slot, dataUrl) => {
        set((s) => ({ photos: { ...s.photos, [slot]: dataUrl } }));
        get().addAudit("Foto salva", `Foto ${slot} vinculada a OS-1048`);
      },

      saveSignature: (dataUrl) => {
        set({ signature: dataUrl });
        get().addAudit("Assinatura salva", "Assinatura do cliente vinculada a OS-1048");
      },

      clearSignature: () => set({ signature: null }),

      verifyChip: (id) => {
        set({ chipId: id });
        get().addAudit("ID do chip confirmado", id);
      },
    }),
    { name: "controle-os-next-v1" },
  ),
);
