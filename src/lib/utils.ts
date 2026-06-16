import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function userInitials(value: string | undefined, fallback = "—"): string {
  if (!value) return fallback;
  const base = value.includes("@") ? value.split("@")[0] : value;
  const parts = base.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase() || fallback;
}

export function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function nowLabel() {
  return new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function currentDateValue() {
  const now = new Date();
  return `${currentMonthValue()}-${String(now.getDate()).padStart(2, "0")}`;
}

export function formatDateShort(value?: string) {
  if (!value) return "Sem data";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}`;
}

export function monthLabel(value?: string) {
  if (!value) return "mes atual";
  const [year, month] = value.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

/**
 * Retorna a data de amanhã no formato YYYY-MM-DD.
 * Útil como valor padrão para campos de prazo em formulários.
 */
export function tomorrowDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Formata um valor em reais de forma abreviada.
 * Ex: 1500 → "R$1.5k", 800 → "R$800"
 */
export function formatCurrencyShort(value: number): string {
  if (!value) return "—";
  if (value >= 1000) return `R$${(value / 1000).toFixed(1)}k`;
  return `R$${value.toFixed(0)}`;
}

/**
 * Retorna tempo relativo desde uma data ISO.
 * Ex: "2d", "3h", "45min", "agora"
 */
export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (days  > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (mins  > 0) return `${mins}min`;
  return "agora";
}
