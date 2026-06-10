"use client";

import { useState } from "react";
import { Eye, EyeOff, KeyRound, Pencil, Plus, X } from "lucide-react";
import { Card, SectionHeading } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DeleteButton } from "@/components/ui/delete-button";
import { cn } from "@/lib/utils";
import {
  useUsers, useCreateUser, useUpdateUser, useResetUserPassword, useRemoveUser, type AppUser,
} from "@/hooks/useUsers";

const ROLES = [
  { value: "ADMIN",      label: "Administrador" },
  { value: "SUPERVISOR", label: "Supervisor"    },
  { value: "ATTENDANT",  label: "Atendente"     },
  { value: "TECHNICIAN", label: "Tecnico"       },
  { value: "STOCK",      label: "Estoque"       },
  { value: "FINANCIAL",  label: "Financeiro"    },
] as const;

type RoleValue = (typeof ROLES)[number]["value"];

const roleTone: Record<string, "teal" | "amber" | "dark"> = {
  ADMIN:      "dark",
  SUPERVISOR: "teal",
  STOCK:      "amber",
  TECHNICIAN: "teal",
  ATTENDANT:  "teal",
  FINANCIAL:  "amber",
};

const ROLE_DESCS: Record<string, string> = {
  ADMIN:      "Acesso total — usuarios, financeiro, estoque, OS, relatorios e auditoria.",
  SUPERVISOR: "Operacoes e relatorios — OS, agenda, equipes, rastreamento, clientes e relatorios.",
  ATTENDANT:  "Cria/edita OS, agenda equipes, acessa rastreamento.",
  TECHNICIAN: "Ve apenas suas OS, registra execucao e solicita materiais.",
  STOCK:      "Cadastra produtos, movimenta estoque e aprova solicitacoes.",
  FINANCIAL:  "Acessa relatorios financeiros e resumo de OS.",
};

function RoleSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="flex h-9 w-full rounded-[10px] border border-line bg-panel px-3 py-1 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal/40">
      {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
    </select>
  );
}

function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Minimo 8 caracteres"} className="pr-9" />
      <button type="button" onClick={() => setShow((s) => !s)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors">
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function CreateUserForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<RoleValue>("ATTENDANT");
  const create = useCreateUser();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({ name: name || undefined, email, password, role });
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[12px] border border-line bg-panel-soft/40 p-4 space-y-3">
      <strong className="block text-sm text-ink">Novo usuario</strong>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="nu-name">Nome</Label>
          <Input id="nu-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo (opcional)" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="nu-email">E-mail</Label>
          <Input id="nu-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@empresa.com" required />
        </div>
        <div className="space-y-1">
          <Label>Senha</Label>
          <PasswordInput value={password} onChange={setPassword} />
        </div>
        <div className="space-y-1">
          <Label>Perfil</Label>
          <RoleSelect value={role} onChange={(v) => setRole(v as RoleValue)} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={create.isPending}>{create.isPending ? "Criando..." : "Criar usuario"}</Button>
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
      </div>
    </form>
  );
}

function EditRoleForm({ user, onClose }: { user: AppUser; onClose: () => void }) {
  const [name, setName]     = useState(user.name ?? "");
  const [role, setRole]     = useState(user.role);
  const [active, setActive] = useState(user.active);
  const update = useUpdateUser();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await update.mutateAsync({ id: user.id, name: name || undefined, role, active });
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[12px] border border-line bg-panel-soft/40 p-4 space-y-3">
      <strong className="block text-sm text-ink">Editar — <span className="text-muted font-normal">{user.email}</span></strong>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1 sm:col-span-1">
          <Label>Nome</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" />
        </div>
        <div className="space-y-1">
          <Label>Perfil</Label>
          <RoleSelect value={role} onChange={setRole} />
        </div>
        <div className="space-y-1">
          <Label>Status</Label>
          <label className="flex items-center gap-2 h-9 text-sm cursor-pointer">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)}
              className="size-4 rounded border-line accent-teal" />
            Conta ativa
          </label>
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={update.isPending}>{update.isPending ? "Salvando..." : "Salvar"}</Button>
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
      </div>
    </form>
  );
}

function ResetPasswordForm({ user, onClose }: { user: AppUser; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const reset = useResetUserPassword();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await reset.mutateAsync({ id: user.id, password });
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[12px] border border-line bg-panel-soft/40 p-4 space-y-3">
      <strong className="block text-sm text-ink">Redefinir senha — <span className="text-muted font-normal">{user.email}</span></strong>
      <div className="max-w-xs space-y-1">
        <Label>Nova senha</Label>
        <PasswordInput value={password} onChange={setPassword} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={reset.isPending}>{reset.isPending ? "Salvando..." : "Redefinir"}</Button>
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
      </div>
    </form>
  );
}

function UserRow({ user }: { user: AppUser }) {
  const [mode, setMode] = useState<"idle" | "edit-role" | "reset-pw">("idle");
  const remove = useRemoveUser();
  const roleLabel = ROLES.find((r) => r.value === user.role)?.label ?? user.role;

  return (
    <div className="space-y-2">
      <article className={cn("rounded-[10px] border border-line bg-panel p-3 transition-colors", !user.active && "opacity-60")}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {user.name && <span className="text-sm font-semibold text-ink">{user.name}</span>}
              <span className={cn("text-sm truncate", user.name ? "text-muted" : "font-semibold text-ink")}>{user.email}</span>
              <Badge tone={roleTone[user.role] ?? "dark"}>{roleLabel}</Badge>
              {!user.active && <Badge tone="dark">Inativo</Badge>}
            </div>
            <small className="text-xs text-muted">Desde {new Date(user.createdAt).toLocaleDateString("pt-BR")}</small>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setMode((m) => (m === "edit-role" ? "idle" : "edit-role"))} title="Editar"
              className={cn("rounded p-1.5 transition-colors", mode === "edit-role" ? "text-teal bg-teal/10" : "text-muted hover:text-ink hover:bg-panel-soft")}>
              <Pencil className="size-3.5" />
            </button>
            <button onClick={() => setMode((m) => (m === "reset-pw" ? "idle" : "reset-pw"))} title="Redefinir senha"
              className={cn("rounded p-1.5 transition-colors", mode === "reset-pw" ? "text-teal bg-teal/10" : "text-muted hover:text-ink hover:bg-panel-soft")}>
              <KeyRound className="size-3.5" />
            </button>
            <DeleteButton compact disabled={remove.isPending} onConfirm={() => remove.mutate(user.id)} />
          </div>
        </div>
      </article>
      {mode === "edit-role" && <EditRoleForm user={user} onClose={() => setMode("idle")} />}
      {mode === "reset-pw" && <ResetPasswordForm user={user} onClose={() => setMode("idle")} />}
    </div>
  );
}

export function ProfilesPanel() {
  const { data: users = [], isLoading } = useUsers();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <Card>
      <SectionHeading eyebrow="Controle de acesso" title="Usuarios do sistema">
        <Button size="sm" onClick={() => setShowCreate((s) => !s)} variant={showCreate ? "secondary" : "primary"}>
          {showCreate ? <><X /> Cancelar</> : <><Plus /> Novo usuario</>}
        </Button>
      </SectionHeading>

      {showCreate && <CreateUserForm onClose={() => setShowCreate(false)} />}

      <div className="mt-4 space-y-2">
        {isLoading && <p className="text-xs text-muted py-4 text-center">Carregando...</p>}
        {!isLoading && users.length === 0 && <p className="text-xs text-muted py-4 text-center">Nenhum usuario cadastrado.</p>}
        {users.map((u) => <UserRow key={u.id} user={u} />)}
      </div>

      <div className="mt-6">
        <strong className="mb-3 block text-xs text-muted uppercase tracking-widest">Referencia de perfis</strong>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {ROLES.map((r) => (
            <div key={r.value} className="rounded-[10px] border border-line bg-panel-soft/40 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Badge tone={roleTone[r.value] ?? "dark"}>{r.label}</Badge>
              </div>
              <p className="text-xs text-muted">{ROLE_DESCS[r.value]}</p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
