"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  Camera,
  CheckCircle2,
  ClipboardList,
  Home,
  MapPin,
  Package,
  Phone,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SignaturePad } from "@/components/tecnico/signature-pad";
import { LionShield } from "@/components/layout/LionShield";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  useServiceOrders,
  useUpdateServiceOrderStatus,
  useUpdateExecution,
  type ServiceOrder,
} from "@/hooks/useServiceOrders";
import { useProducts } from "@/hooks/useProducts";
import { useCreateMaterialRequest } from "@/hooks/useMaterialRequests";

type Tab = "inicio" | "os" | "materiais";

const PHOTO_SLOTS = [
  { slot: 0, label: "Antes" },
  { slot: 1, label: "Durante" },
  { slot: 2, label: "Depois" },
];

function toPriorityLevel(p: string): "high" | "medium" | "low" {
  if (p === "HIGH") return "high";
  if (p === "WARNING") return "medium";
  return "low";
}

function priorityColor(p: "high" | "medium" | "low") {
  if (p === "high") return "bg-red-500";
  if (p === "medium") return "bg-amber-400";
  return "bg-emerald-500";
}

function statusLabel(s: string) {
  if (s === "IN_PROGRESS" || s === "WAITING_PARTS") return "Em andamento";
  if (s === "COMPLETED") return "Concluída";
  if (s === "CANCELLED") return "Cancelada";
  return "Aberta";
}

export default function TecnicoPage() {
  const { data: currentUser, isLoading: userLoading } = useCurrentUser();
  const technicianId = currentUser?.technician?.id;

  const { data: osData, isLoading: ordersLoading } = useServiceOrders(
    technicianId ? { technicianId, limit: 50 } : {}
  );
  const orders = osData?.serviceOrders ?? [];

  const { data: products = [] } = useProducts();
  const updateStatus = useUpdateServiceOrderStatus();
  const updateExecution = useUpdateExecution();
  const createRequest = useCreateMaterialRequest();

  const [activeTab, setActiveTab] = useState<Tab>("inicio");
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [localPhotos, setLocalPhotos] = useState<Record<number, string>>({});
  const [localSignature, setLocalSignature] = useState<string | null>(null);
  const [chipDraft, setChipDraft] = useState("");
  const [chipConfirmed, setChipConfirmed] = useState(false);
  const [reqProductId, setReqProductId] = useState("");
  const [reqQty, setReqQty] = useState(1);

  const fileRef = useRef<HTMLInputElement>(null);
  const targetSlot = useRef<number>(0);

  const activeOrder = orders.find((o) => o.id === activeOrderId) ?? null;
  const activeOrders = orders.filter(
    (o) => o.status !== "COMPLETED" && o.status !== "CANCELLED"
  );
  const doneOrders = orders.filter((o) => o.status === "COMPLETED");

  const photoCount = PHOTO_SLOTS.filter(({ slot }) => {
    return localPhotos[slot] || activeOrder?.photoUrls?.[slot];
  }).length;

  const checkinDone = !!activeOrder?.checkinAt;
  const signatureDone = !!(activeOrder?.clientSignature || localSignature);
  const chipOk =
    !!(activeOrder?.chipId && activeOrder.chipId.replace(/\D/g, "").length >= 5) ||
    chipConfirmed;

  const canFinish =
    activeOrder?.status !== "COMPLETED" &&
    checkinDone &&
    photoCount >= 3 &&
    signatureDone &&
    chipOk;

  function pickPhoto(slot: number) {
    targetSlot.current = slot;
    fileRef.current?.click();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activeOrder) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setLocalPhotos((prev) => ({ ...prev, [targetSlot.current]: dataUrl }));
      const current = activeOrder.photoUrls ?? [];
      const next = [...current];
      next[targetSlot.current] = dataUrl;
      await updateExecution.mutateAsync({ id: activeOrder.id, photoUrls: next });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function handleCheckin(order: ServiceOrder) {
    await updateExecution.mutateAsync({
      id: order.id,
      checkinAt: new Date().toISOString(),
    });
    await updateStatus.mutateAsync({ id: order.id, status: "IN_PROGRESS" });
    setActiveOrderId(order.id);
    setActiveTab("os");
  }

  async function handleSignature(sig: string) {
    setLocalSignature(sig);
    if (!activeOrder) return;
    await updateExecution.mutateAsync({ id: activeOrder.id, clientSignature: sig });
  }

  async function handleChip() {
    if (!activeOrder || !chipDraft) return;
    await updateExecution.mutateAsync({ id: activeOrder.id, chipId: chipDraft });
    setChipConfirmed(chipDraft.replace(/\D/g, "").length >= 5);
  }

  async function handleFinish() {
    if (!activeOrder || !canFinish) return;
    await updateExecution.mutateAsync({
      id: activeOrder.id,
      checkoutAt: new Date().toISOString(),
    });
    await updateStatus.mutateAsync({ id: activeOrder.id, status: "COMPLETED" });
    setActiveOrderId(null);
    setLocalPhotos({});
    setLocalSignature(null);
    setChipDraft("");
    setChipConfirmed(false);
    setActiveTab("inicio");
  }

  async function handleRequest() {
    if (!activeOrder || !reqProductId) return;
    await createRequest.mutateAsync({
      serviceOrderId: activeOrder.id,
      productId: reqProductId,
      quantity: reqQty,
    });
    setReqQty(1);
    setReqProductId("");
  }

  if (userLoading) {
    return (
      <div className="grid min-h-[100dvh] place-items-center text-muted-foreground text-sm">
        Carregando...
      </div>
    );
  }

  if (!technicianId) {
    return (
      <div className="grid min-h-[100dvh] place-items-center px-6">
        <div className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            Perfil de técnico não encontrado para este usuário.
          </p>
          <Link href="/" className="text-amber underline text-sm">
            Voltar ao painel
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col max-w-md mx-auto">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={onFile}
      />

      {/* HEADER */}
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Link href="/" className="shrink-0 text-muted-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="shrink-0 size-8 rounded-md bg-onyx grid place-items-center">
          <LionShield className="size-5 text-silver" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest leading-none">
            Área do Técnico
          </p>
          <p className="text-sm font-semibold text-foreground truncate leading-tight">
            {currentUser?.technician?.name ?? "Técnico"}
          </p>
        </div>
        {currentUser?.technician?.team && (
          <span className="shrink-0 rounded-sm bg-amber-soft border border-amber/30 px-2 py-0.5 text-[11px] font-semibold text-amber">
            {currentUser.technician.team}
          </span>
        )}
      </header>

      {/* CONTENT */}
      <main className="flex-1 overflow-y-auto pb-20">
        {activeTab === "inicio" && (
          <div className="flex flex-col gap-4 p-4">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "OS do dia", value: orders.length },
                { label: "Pendentes", value: activeOrders.length },
                { label: "Concluídas", value: doneOrders.length },
                { label: "Equipe", value: currentUser?.technician?.team ?? "—" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border border-border bg-card p-3.5"
                >
                  <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
                  <p className="text-xl font-bold text-foreground mt-0.5 truncate">
                    {s.value}
                  </p>
                </div>
              ))}
            </div>

            {/* OS list */}
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Ordens de Serviço
            </p>

            {ordersLoading && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Carregando...
              </p>
            )}

            {!ordersLoading && orders.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma OS atribuída a você.
              </p>
            )}

            <div className="flex flex-col gap-3">
              {orders.map((order) => {
                const priority = toPriorityLevel(order.priority);
                const isDone =
                  order.status === "COMPLETED" || order.status === "CANCELLED";
                const isActive = order.id === activeOrderId;
                return (
                  <div
                    key={order.id}
                    className={cn(
                      "rounded-xl border bg-card p-4 relative overflow-hidden",
                      isActive && "border-amber/40"
                    )}
                  >
                    <div
                      className={cn(
                        "absolute left-0 top-0 bottom-0 w-1 rounded-l-xl",
                        priorityColor(priority)
                      )}
                    />
                    <div className="pl-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground leading-tight truncate">
                          {order.client?.name ?? "Cliente"}
                        </p>
                        <span
                          className={cn(
                            "shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-sm",
                            isDone
                              ? "bg-muted text-muted-foreground"
                              : isActive
                              ? "bg-amber-soft text-amber border border-amber/30"
                              : "bg-muted text-foreground"
                          )}
                        >
                          {statusLabel(order.status)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {order.description ?? "Sem descrição"}
                      </p>
                      <div className="flex gap-2 mt-3">
                        {!isDone && order.status === "OPEN" && (
                          <Button
                            size="sm"
                            className="bg-amber text-onyx hover:bg-amber/90 text-xs h-7 px-3"
                            onClick={() => handleCheckin(order)}
                            disabled={updateStatus.isPending}
                          >
                            Iniciar
                          </Button>
                        )}
                        {(order.status === "IN_PROGRESS" ||
                          order.status === "WAITING_PARTS") && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="text-xs h-7 px-3"
                            onClick={() => {
                              setActiveOrderId(order.id);
                              setActiveTab("os");
                            }}
                          >
                            Abrir OS
                          </Button>
                        )}
                        {isDone && (
                          <span className="inline-flex items-center gap-1 text-xs text-status-done">
                            <CheckCircle2 className="size-3.5" />
                            Concluída
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "os" && (
          <div className="flex flex-col gap-4 p-4">
            {!activeOrder ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <ClipboardList className="size-12 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground text-center">
                  Nenhuma OS ativa. Selecione uma na aba Início.
                </p>
                <Button variant="secondary" size="sm" onClick={() => setActiveTab("inicio")}>
                  Ver OS
                </Button>
              </div>
            ) : (
              <>
                {/* OS card */}
                <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                        Cliente
                      </p>
                      <h2 className="text-base font-semibold text-foreground leading-tight">
                        {activeOrder.client?.name}
                      </h2>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-sm bg-amber-soft text-amber border border-amber/30">
                      {statusLabel(activeOrder.status)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {activeOrder.description ?? "Sem descrição"}
                  </p>
                  <div className="flex gap-2">
                    {activeOrder.client?.phone && (
                      <Button variant="secondary" size="sm" className="flex-1" asChild>
                        <a href={`tel:${activeOrder.client.phone}`}>
                          <Phone className="size-3.5" /> Ligar
                        </a>
                      </Button>
                    )}
                    <Button variant="secondary" size="sm" className="flex-1" asChild>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activeOrder.client?.name ?? "")}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MapPin className="size-3.5" /> Rota
                      </a>
                    </Button>
                  </div>
                  {!checkinDone && (
                    <Button
                      className="w-full bg-amber text-onyx hover:bg-amber/90"
                      disabled={updateExecution.isPending}
                      onClick={() => handleCheckin(activeOrder)}
                    >
                      Iniciar atendimento
                    </Button>
                  )}
                </div>

                {/* Progress bar */}
                {(() => {
                  const items = [
                    { label: "Check-in", done: checkinDone },
                    { label: `Fotos ${photoCount}/3`, done: photoCount >= 3 },
                    { label: "Assinatura", done: signatureDone },
                    { label: "Chip ID", done: chipOk },
                  ];
                  const pct = Math.round(
                    (items.filter((i) => i.done).length / items.length) * 100
                  );
                  return (
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground font-medium">
                          Checklist de conclusão
                        </span>
                        <span className="text-xs font-semibold text-amber">{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-amber rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        {items.map((item) => (
                          <span
                            key={item.label}
                            className={cn(
                              "flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium",
                              item.done
                                ? "border-status-done/40 bg-status-done/10 text-status-done"
                                : "border-border text-muted-foreground"
                            )}
                          >
                            <CheckCircle2
                              className={cn(
                                "size-3.5",
                                item.done ? "text-status-done" : "text-muted-foreground/30"
                              )}
                            />
                            {item.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Fotos */}
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-semibold">Fotos</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {PHOTO_SLOTS.map(({ slot, label }) => {
                      const existing = activeOrder.photoUrls?.[slot];
                      const local = localPhotos[slot];
                      const src = local || existing;
                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => pickPhoto(slot)}
                          className="relative aspect-square rounded-xl border-2 border-dashed border-border hover:border-amber/40 bg-muted/30 grid place-items-center overflow-hidden transition-colors"
                        >
                          {src ? (
                            src.startsWith("data:") ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={src}
                                alt={label}
                                className="absolute inset-0 size-full object-cover"
                              />
                            ) : (
                              <CheckCircle2 className="size-6 text-status-done" />
                            )
                          ) : (
                            <Camera className="size-5 text-muted-foreground/50" />
                          )}
                          <span className="absolute bottom-1 text-[10px] font-semibold text-foreground/60">
                            {label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Assinatura */}
                <SignaturePad
                  value={localSignature ?? activeOrder.clientSignature ?? null}
                  onConfirm={handleSignature}
                  onClear={() => setLocalSignature(null)}
                />

                {/* Chip */}
                <div className="rounded-lg border border-border bg-muted/30 p-3 flex flex-col gap-2">
                  <Label className="text-sm font-semibold">ID do Chip</Label>
                  <Input
                    value={chipDraft || activeOrder.chipId || ""}
                    onChange={(e) => setChipDraft(e.target.value)}
                    placeholder="8955 0400 1234 5678"
                  />
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={handleChip}
                    disabled={updateExecution.isPending}
                  >
                    <BadgeCheck className="size-4" /> Confirmar ID do chip
                  </Button>
                  {chipOk && (
                    <p className="text-xs text-status-done text-center">
                      ID confirmado: {activeOrder.chipId ?? chipDraft}
                    </p>
                  )}
                </div>

                {/* Finalizar */}
                <Button
                  className="w-full bg-amber text-onyx hover:bg-amber/90 font-semibold"
                  disabled={!canFinish || updateStatus.isPending}
                  onClick={handleFinish}
                >
                  {activeOrder.status === "COMPLETED"
                    ? "OS Concluída"
                    : "Finalizar OS"}
                </Button>
              </>
            )}
          </div>
        )}

        {activeTab === "materiais" && (
          <div className="flex flex-col gap-4 p-4">
            <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-4">
              <h2 className="text-base font-semibold text-foreground">
                Solicitar Material
              </h2>
              {!activeOrder && (
                <p className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">
                  Abra uma OS primeiro para solicitar materiais.
                </p>
              )}
              <Select
                value={reqProductId}
                onValueChange={setReqProductId}
                disabled={!activeOrder}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um produto" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem
                      key={p._apiId ?? String(p.id)}
                      value={p._apiId ?? String(p.id)}
                    >
                      {p.name}
                      {p.qty !== undefined ? ` (${p.qty} em estoque)` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2 items-center">
                <Label className="shrink-0 text-sm">Qtd:</Label>
                <Input
                  type="number"
                  min={1}
                  value={reqQty}
                  onChange={(e) => setReqQty(Math.max(1, Number(e.target.value)))}
                  className="w-24"
                />
              </div>
              <Button
                className="w-full bg-amber text-onyx hover:bg-amber/90 font-semibold"
                onClick={handleRequest}
                disabled={!activeOrder || !reqProductId || createRequest.isPending}
              >
                {createRequest.isPending ? "Enviando..." : "Solicitar material"}
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* BOTTOM NAV */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto h-16 bg-card border-t border-border flex z-30">
        {(
          [
            { key: "inicio", icon: <Home className="size-5" />, label: "Início" },
            {
              key: "os",
              icon: <ClipboardList className="size-5" />,
              label: "OS Ativa",
              badge: activeOrder ? activeOrders.length : undefined,
            },
            {
              key: "materiais",
              icon: <Package className="size-5" />,
              label: "Materiais",
            },
          ] as Array<{
            key: Tab;
            icon: React.ReactNode;
            label: string;
            badge?: number;
          }>
        ).map(({ key, icon, label, badge }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-colors",
              activeTab === key ? "text-amber" : "text-muted-foreground"
            )}
          >
            {activeTab === key && (
              <span className="absolute top-0 left-4 right-4 h-0.5 rounded-full bg-amber" />
            )}
            <span className="relative">
              {icon}
              {badge !== undefined && badge > 0 && (
                <span className="absolute -top-1 -right-2 size-4 rounded-full bg-amber text-onyx text-[10px] font-bold grid place-items-center">
                  {badge}
                </span>
              )}
            </span>
            <span className="text-[10px] font-medium leading-none">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
