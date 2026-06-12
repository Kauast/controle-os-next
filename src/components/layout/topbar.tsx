"use client";

import { Bell, LogIn, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { roleViewCopy } from "@/lib/access";
import { useAppStore } from "@/store/use-app-store";
import { useUIStore } from "@/store/use-ui-store";

export function Topbar() {
  const role = useAppStore((s) => s.role);
  const activeAccount = useAppStore((s) => s.activeTeamAccount);
  const setNewOsOpen = useUIStore((s) => s.setNewOsOpen);
  const setTeamLoginOpen = useUIStore((s) => s.setTeamLoginOpen);

  const copy = roleViewCopy[role] ?? { context: "Sistema", title: "Dashboard" };
  const accountLabel = activeAccount ? `${activeAccount.team} logada` : null;

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 px-4 py-4 backdrop-blur-xl lg:px-7">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">{copy.context}</p>
          <h1 className="text-xl font-bold text-white lg:text-2xl">{copy.title}</h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="icon"
            size="icon"
            aria-label="Pesquisar"
            className="size-10 rounded-2xl border border-white/10 bg-transparent text-zinc-200 hover:bg-white/10"
          >
            <Search className="size-4" />
          </Button>

          <Button
            variant="icon"
            size="icon"
            aria-label="Notificacoes"
            className="size-10 rounded-2xl border border-white/10 bg-transparent text-zinc-200 hover:bg-white/10"
          >
            <Bell className="size-4" />
          </Button>

          <button
            onClick={() => setTeamLoginOpen(true)}
            className="hidden items-center gap-2 rounded-2xl border border-white/10 px-4 py-2 text-sm text-zinc-200 hover:bg-white/10 lg:flex"
          >
            <LogIn className="size-4" /> Conta equipe
          </button>

          {(role === "admin" || role === "atendimento") && (
            <button
              onClick={() => setNewOsOpen(true)}
              className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-zinc-100"
            >
              <Plus className="size-4" /> Nova OS
            </button>
          )}

          {accountLabel && (
            <span className="hidden rounded-full border border-white/10 bg-[#101010] px-3 py-1.5 text-xs text-zinc-300 lg:block">
              {accountLabel}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
