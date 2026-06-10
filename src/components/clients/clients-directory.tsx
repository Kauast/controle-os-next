"use client";

import { Search, Users } from "lucide-react";

export function ClientsDirectory() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#101010] px-4 py-3">
        <Search className="size-4 text-zinc-500" />
        <input
          placeholder="Buscar cliente ou endereco..."
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
        />
      </div>
      <div className="rounded-2xl border border-white/10 bg-[#101010] p-6">
        <div className="flex items-center gap-3">
          <Users className="size-5 text-zinc-400" />
          <h2 className="text-lg font-bold text-white">Diretorio de clientes</h2>
        </div>
        <p className="mt-2 text-sm text-zinc-400">
          Listagem rapida de contatos, enderecos e historico de OS.
        </p>
      </div>
    </div>
  );
}
