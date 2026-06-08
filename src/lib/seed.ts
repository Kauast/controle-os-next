import type {
  MaterialRequest,
  Product,
  ServiceOrder,
  StockMovement,
  TeamAccount,
  TeamLocation,
  Technician,
} from "./types";

export const seedTeamAccounts: TeamAccount[] = [
  { team: "Equipe 1", user: "equipe1", password: "equipe1", members: "Bruno e Leo" },
  { team: "Equipe 2", user: "equipe2", password: "equipe2", members: "Ana e Rui" },
  { team: "Equipe 3", user: "equipe3", password: "equipe3", members: "Marcos e Bia" },
  { team: "Equipe 4", user: "equipe4", password: "equipe4", members: "Diego e Caio" },
  { team: "Equipe 5", user: "equipe5", password: "equipe5", members: "Plantao" },
];

export const seedOrders: ServiceOrder[] = [
  { code: "OS-1048", client: "Alpha Condominio", description: "Portao automatico sem resposta - 2 produtos no cliente", tech: "Bruno", time: "09:30", team: "Equipe 1", priority: "high", status: "pending", scheduledDate: undefined },
  { code: "OS-1049", client: "Mercado Central", description: "Preventiva em cameras CFTV", tech: "Marcos", time: "11:00", team: "Equipe 3", priority: "normal", status: "pending" },
  { code: "OS-1050", client: "Clinica Santa Clara", description: "Troca de fonte e bateria", tech: "Ana", time: "14:00", team: "Equipe 2", priority: "warning", status: "pending" },
  { code: "OS-1051", client: "Residencial Norte", description: "Instalacao de leitor facial", tech: "Diego", time: "16:30", team: "Equipe 4", priority: "normal", status: "pending" },
  { code: "OS-1052", client: "Banco Solar", description: "Alarme disparando", tech: "", time: "08:30", team: "Sem equipe", priority: "high", status: "pending" },
  { code: "OS-1053", client: "Loja Prime", description: "Camera sem imagem", tech: "", time: "10:00", team: "Sem equipe", priority: "normal", status: "pending" },
  { code: "OS-1054", client: "Condominio Lago", description: "Fechadura eletronica", tech: "", time: "13:30", team: "Sem equipe", priority: "warning", status: "pending" },
  { code: "OS-1055", client: "Galpao Norte", description: "Rede e DVR", tech: "", time: "15:00", team: "Sem equipe", priority: "normal", status: "pending" },
];

export const seedProducts: Product[] = [
  { id: 1, name: "Fonte 12V 2A", sku: "FON-12V-2A", category: "Eletrica", location: "Prateleira A1", qty: 8, min: 20, cost: 29, price: 48, qr: "PROD:FON-12V-2A" },
  { id: 2, name: "Bateria 7Ah", sku: "BAT-7AH", category: "Energia", location: "Prateleira A2", qty: 10, min: 12, cost: 62, price: 96, qr: "PROD:BAT-7AH" },
  { id: 3, name: "Cabo UTP Cat6", sku: "CAB-CAT6", category: "Rede", location: "Corredor B1", qty: 5, min: 6, cost: 270, price: 420, qr: "PROD:CAB-CAT6" },
  { id: 4, name: "Sensor magnetico", sku: "SEN-MAG", category: "Alarme", location: "Gaveta C3", qty: 42, min: 30, cost: 18, price: 32, qr: "PROD:SEN-MAG" },
  { id: 5, name: "Camera dome Full HD", sku: "CAM-DOME-FHD", category: "CFTV", location: "Armario D1", qty: 14, min: 8, cost: 128, price: 189, qr: "PROD:CAM-DOME-FHD" },
  { id: 6, name: "Controle remoto TX", sku: "CTRL-TX", category: "Automacao", location: "Gaveta C1", qty: 24, min: 15, cost: 34, price: 58, qr: "PROD:CTRL-TX" },
];

export const seedMovements: StockMovement[] = [
  { id: 1, product: "Fonte 12V 2A", type: "saida", qty: 1, user: "Estoque", date: "Hoje 10:05", reason: "OS", before: 9, after: 8 },
  { id: 2, product: "Bateria 7Ah", type: "entrada", qty: 4, user: "Estoque", date: "Hoje 08:20", reason: "Fornecedor B", before: 6, after: 10 },
];

export const seedRequests: MaterialRequest[] = [];

export const seedTechnicians: Technician[] = [
  { id: 1, name: "Bruno", phone: "(11) 90000-0004", status: "Em atendimento", team: "Equipe 1" },
  { id: 2, name: "Ana", phone: "(11) 90000-0005", status: "A caminho", team: "Equipe 2" },
  { id: 3, name: "Marcos", phone: "(11) 90000-0006", status: "Checklist final", team: "Equipe 3" },
  { id: 4, name: "Diego", phone: "(11) 90000-0007", status: "Disponivel", team: "Equipe 4" },
];

export const seedLocations: TeamLocation[] = [
  { team: "Equipe 1", vehicle: "Carro 01", x: 22, y: 48, status: "Em atendimento", speed: 0, updated: "Agora" },
  { team: "Equipe 2", vehicle: "Carro 02", x: 58, y: 35, status: "A caminho", speed: 38, updated: "Agora" },
  { team: "Equipe 3", vehicle: "Carro 03", x: 42, y: 68, status: "Em rota", speed: 44, updated: "Agora" },
  { team: "Equipe 4", vehicle: "Carro 04", x: 74, y: 54, status: "Agendada", speed: 18, updated: "Agora" },
  { team: "Equipe 5", vehicle: "Plantao", x: 82, y: 23, status: "Disponivel", speed: 0, updated: "Agora" },
];

export const teamCompletedBase: Record<string, number> = {
  "Equipe 1": 18,
  "Equipe 2": 14,
  "Equipe 3": 16,
  "Equipe 4": 11,
  "Equipe 5": 7,
};

export const teamReportMeta: Record<
  string,
  { time: string; photos: string; signatures: string; status: string; pill: "teal" | "amber" }
> = {
  "Equipe 1": { time: "1h42", photos: "100%", signatures: "100%", status: "No padrao", pill: "teal" },
  "Equipe 2": { time: "2h05", photos: "96%", signatures: "93%", status: "Acompanhar", pill: "amber" },
  "Equipe 3": { time: "1h58", photos: "98%", signatures: "100%", status: "No padrao", pill: "teal" },
  "Equipe 4": { time: "2h26", photos: "91%", signatures: "88%", status: "Revisar", pill: "amber" },
  "Equipe 5": { time: "1h35", photos: "100%", signatures: "100%", status: "Plantao ok", pill: "teal" },
};
