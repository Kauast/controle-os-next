"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowLeft, BadgeCheck, Camera, CheckCircle2, MapPin, Phone } from "lucide-react";
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
import { orderLabel } from "@/lib/orders";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useServiceOrders, useUpdateServiceOrderStatus, useUpdateExecution } from "@/hooks/useServiceOrders";
import { useProducts } from "@/hooks/useProducts";
import { useCreateMaterialRequest } from "@/hooks/useMaterialRequests";
import type { ServiceOrder as BackendServiceOrder } from "@/hooks/useServiceOrders";

const PHOTO_SLOTS = [
  { slot: "0", label: "Antes" },
  { slot: "1", label: "Durante" },
  { slot: "2", label: "Depois" },
];

function mapStatus(status: string) {
  if (status === "COMPLETED" || status === "CANCELLED") return "completed";
  return "pending";
}

function mapPriority(p: string): "normal" | "warning" | "high" {
  if (p === "HIGH") return "high";
  if (p === "WARNING") return "warning";
  return "normal";
}

function adaptOrder(os: BackendServiceOrder) {
  return {
    ...os,
    code: `OS-${String(os.number).padStart(4, "0")}`,
    clientName: (os.client as { name: string })?.name ?? "",
    clientPhone: (os.client as { phone?: string })?.phone ?? "",
    status: mapStatus(os.status),
    priority: mapPriority(os.priority),
    description: os.description ?? "",
    scheduledTime: os.scheduledTime ?? "00:00",
  };
}

export default function TecnicoPage() {
  const { data: currentUser, isLoading: userLoading } = useCurrentUser();
  const technicianId = currentUser?.technician?.id;

  const { data: osData, isLoading: osLoading } = useServiceOrders(
    technicianId ? { technicianId, limit: 50 } : {}
  );
  const backendOrders = osData?.serviceOrders ?? [];
  const orders = backendOrders.map(adaptOrder);
  const activeOrder = orders.find((o) => o.status !== "completed") ?? orders[0];
  const activeBackend = backendOrders.find((o) => o.id === activeOrder?.id);

  const { data: products = [] } = useProducts();

  const updateStatus = useUpdateServiceOrderStatus();
  const updateExecution = useUpdateExecution();
  const createRequest = useCreateMaterialRequest();

  const fileRef = useRef<HTMLInputElement>(null);
  const targetSlot = useRef<string>("0");

  const [localPhotos, setLocalPhotos] = useState<Record<string, string>>({});
  const [localSignature, setLocalSignature] = useState<string | null>(null);
  const [chipDraft, setChipDraft] = useState("");
  const [chipConfirmed, setChipConfirmed] = useState(false);
  const [reqProductId, setReqProductId] = useState("");
  const [reqQty, setReqQty] = useState(1);

  if (userLoading || osLoading) {
    return <div className="grid min-h-screen place-items-center text-muted">Carregando...</div>;
  }

  if (!technicianId) {
    return (
      <div className="grid min-h-screen place-items-center text-muted">
        <div className="text-center">
          <p className="text-sm">Perfil de técnico não encontrado para este usuário.</p>
          <Link href="/" className="mt-2 block text-teal underline">
            Voltar ao painel
          </Link>
        </div>
      </div>
    );
  }

  const photoCount = PHOTO_SLOTS.filter((p) => {
    const existing = activeBackend?.photoUrls?.[parseInt(p.slot)];
    return existing || localPhotos[p.slot];
  }).length;

  const checkinDone = !!activeBackend?.checkinAt;
  const signatureDone = !!(activeBackend?.clientSignature || localSignature);
  const chipId = activeBackend?.chipId ?? null;
  const chipOk = !!(chipId && chipId.replace(/\D/g, "").length >= 10) || chipConfirmed;

  const requirements = [
    { key: "checkin", label: "Iniciar atendimento", done: checkinDone },
    { key: "photos", label: "3 fotos", done: photoCount >= 3 },
    { key: "signature", label: "Assinatura", done: signatureDone },
    { key: "chip", label: "ID do chip", done: chipOk },
  ];
  const canFinish = requirements.every((r) => r.done) && activeOrder?.status !== "completed";

  function pickPhoto(slot: string) {
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
      const currentUrls = activeBackend?.photoUrls ?? [];
      const newUrls = [...currentUrls];
      newUrls[parseInt(targetSlot.current)] = dataUrl;
      await updateExecution.mutateAsync({ id: activeOrder.id, photoUrls: newUrls });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function handleCheckin() {
    if (!activeOrder) return;
    await updateExecution.mutateAsync({
      id: activeOrder.id,
      checkinAt: new Date().toISOString(),
    });
    await updateStatus.mutateAsync({ id: activeOrder.id, status: "IN_PROGRESS" });
  }

  async function handleSignature(sig: string) {
    setLocalSignature(sig);
    if (!activeOrder) return;
    await updateExecution.mutateAsync({ id: activeOrder.id, clientSignature: sig });
  }

  async function handleChip() {
    if (!activeOrder) return;
    await updateExecution.mutateAsync({ id: activeOrder.id, chipId: chipDraft });
    setChipConfirmed(chipDraft.replace(/\D/g, "").length >= 10);
  }

  async function handleFinish() {
    if (!activeOrder || !canFinish) return;
    await updateExecution.mutateAsync({ id: activeOrder.id, checkoutAt: new Date().toISOString() });
    await updateStatus.mutateAsync({ id: activeOrder.id, status: "COMPLETED" });
  }

  async function handleRequest() {
    if (!activeOrder || !reqProductId) return;
    await createRequest.mutateAsync({
      serviceOrderId: activeOrder.id,
      productId: reqProductId,
      quantity: reqQty,
    });
    setReqQty(1);
  }

  return (
    <div className="mx-auto min-h-screen max-w-md bg-panel pb-24">
      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />

      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-panel/90 px-4 py-3 backdrop-blur">
        <Link href="/" className="text-muted">
          <ArrowLeft className="size-5" />
        </Link>
        <Image src="/logo.svg" alt="Logo" width={36} height={36} className="rounded-[10px]" />
        <div className="flex-1 leading-tight">
          <span className="text-[11px] text-muted">Area do tecnico</span>
          <strong className="block text-sm text-ink">
            {currentUser?.technician?.name ?? "Minhas OS"}
          </strong>
        </div>
        <span className="rounded-full bg-teal-soft px-2 py-0.5 text-[11px] font-semibold text-teal">
          {currentUser?.technician?.team ?? ""}
        </span>
      </header>

      <div className="flex flex-col gap-4 p-4">
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "OS do dia", value: orders.length },
            { label: "Pendentes", value: orders.filter((o) => o.status !== "completed").length },
            { label: "Concluidas", value: orders.filter((o) => o.status === "completed").length },
            { label: "Equipe", value: currentUser?.technician?.team ?? "—" },
          ].map((s) => (
            <div key={s.label} className="rounded-[12px] border border-line bg-panel-soft/40 p-2.5 text-center">
              <strong className="block text-lg text-ink">{s.value}</strong>
              <span className="text-[10px] text-muted">{s.label}</span>
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-2">
          <strong className="text-sm text-ink">Ordens de servico</strong>
          {orders.map((o) => {
            const fakeOrder = {
              ...o,
              client: o.clientName,
              tech: "",
              time: o.scheduledTime,
              status: (o.status === "completed" ? "completed" : "pending") as import("@/lib/types").OrderStatus,
            };
            const label = orderLabel(fakeOrder);
            return (
              <article
                key={o.id}
                className={cn(
                  "rounded-[12px] border border-line bg-panel-soft/40 p-3",
                  o.id === activeOrder?.id && "border-teal bg-teal-soft/40",
                )}
              >
                <Badge tone={label.pill}>{label.text}</Badge>
                <strong className="mt-1 block text-sm text-ink">{o.code}</strong>
                <small className="text-xs text-muted">
                  {o.clientName} · {o.scheduledTime} · {o.status === "completed" ? "Finalizada" : "Em aberto"}
                </small>
              </article>
            );
          })}
          {orders.length === 0 && (
            <p className="py-6 text-center text-sm text-muted">
              Nenhuma OS atribuida a voce.
            </p>
          )}
        </section>

        {activeOrder && (
          <>
            <motion.article
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[14px] border border-line bg-panel-soft/40 p-4"
            >
              <div className="flex items-center gap-2">
                <Badge tone={activeOrder.priority === "high" ? "red" : activeOrder.priority === "warning" ? "amber" : "teal"}>
                  {activeOrder.priority === "high" ? "Alta" : activeOrder.priority === "warning" ? "Media" : "Normal"}
                </Badge>
                <strong className="text-sm text-ink">{activeOrder.code}</strong>
              </div>
              <h2 className="mt-1 text-lg font-bold text-ink">{activeOrder.clientName}</h2>
              <p className="text-sm text-muted">{activeOrder.description}</p>
              <div className="mt-3 flex gap-2">
                {activeOrder.clientPhone && (
                  <Button variant="secondary" size="sm" className="flex-1" asChild>
                    <a href={`tel:${activeOrder.clientPhone}`}>
                      <Phone /> Ligar
                    </a>
                  </Button>
                )}
                <Button variant="secondary" size="sm" className="flex-1" asChild>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activeOrder.clientName)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MapPin /> Rota
                  </a>
                </Button>
              </div>
              <Button
                className="mt-3 w-full"
                disabled={checkinDone || updateExecution.isPending}
                onClick={handleCheckin}
              >
                {checkinDone ? "Atendimento iniciado" : "Iniciar atendimento"}
              </Button>
            </motion.article>

            <section className="rounded-[14px] border border-line bg-panel-soft/40 p-4">
              <div className="mb-3 flex items-center justify-between">
                <strong className="text-sm text-ink">Conclusao da OS</strong>
                <Badge tone={canFinish ? "teal" : "amber"}>
                  {activeOrder.status === "completed" ? "Concluida" : canFinish ? "Liberado" : "Pendente"}
                </Badge>
              </div>

              <div className="mb-3 grid grid-cols-2 gap-2">
                {requirements.map((r) => (
                  <span
                    key={r.key}
                    className={cn(
                      "flex items-center gap-1.5 rounded-[8px] border px-2 py-1.5 text-xs",
                      r.done
                        ? "border-teal/40 bg-teal-soft/50 text-teal"
                        : "border-amber/40 bg-amber-soft/40 text-amber",
                    )}
                  >
                    <CheckCircle2 className="size-3.5" /> {r.label}
                  </span>
                ))}
              </div>

              <div className="mb-3 grid grid-cols-3 gap-2">
                {PHOTO_SLOTS.map((p) => {
                  const existing = activeBackend?.photoUrls?.[parseInt(p.slot)];
                  const local = localPhotos[p.slot];
                  const src = local || existing;
                  return (
                    <button
                      key={p.slot}
                      onClick={() => pickPhoto(p.slot)}
                      className="relative grid aspect-square place-items-center overflow-hidden rounded-[10px] border border-dashed border-line bg-panel"
                    >
                      {src ? (
                        src.startsWith("data:") ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={src} alt={p.label} className="absolute inset-0 size-full object-cover" />
                        ) : (
                          <CheckCircle2 className="size-6 text-teal" />
                        )
                      ) : (
                        <Camera className="size-5 text-muted" />
                      )}
                      <span className="absolute bottom-1 text-[10px] font-semibold text-ink/80">{p.label}</span>
                    </button>
                  );
                })}
              </div>

              <SignaturePad
                value={localSignature ?? activeBackend?.clientSignature ?? null}
                onConfirm={handleSignature}
                onClear={() => setLocalSignature(null)}
              />

              <div className="mt-3 rounded-[12px] border border-line bg-panel p-3">
                <Label>
                  ID CHIP
                  <Input
                    value={chipDraft || chipId || ""}
                    onChange={(e) => setChipDraft(e.target.value)}
                    placeholder="8955 0400 1234 5678 9012"
                  />
                </Label>
                <Button
                  variant="secondary"
                  className="mt-2 w-full"
                  onClick={handleChip}
                  disabled={updateExecution.isPending}
                >
                  <BadgeCheck /> Confirmar ID do chip
                </Button>
                <small className={cn("mt-1 block text-xs", chipOk ? "text-teal" : "text-muted")}>
                  {chipOk ? `ID confirmado: ${chipId ?? chipDraft}` : "ID do chip pendente"}
                </small>
              </div>

              <Button
                className="mt-3 w-full"
                disabled={!canFinish || updateStatus.isPending}
                onClick={handleFinish}
              >
                {activeOrder.status === "completed" ? "OS concluida" : "Finalizar OS"}
              </Button>
            </section>

            <section className="rounded-[14px] border border-line bg-panel-soft/40 p-4">
              <strong className="mb-2 block text-sm text-ink">Solicitar material</strong>
              <p className="mb-3 text-xs text-muted">
                Confira a quantidade na central antes de solicitar material para esta OS.
              </p>
              <div className="flex flex-col gap-2">
                <Select value={reqProductId} onValueChange={setReqProductId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p._apiId ?? String(p.id)} value={p._apiId ?? String(p.id)}>
                        {p.name} ({p.qty} em estoque)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={1}
                    value={reqQty}
                    onChange={(e) => setReqQty(Math.max(1, Number(e.target.value)))}
                    className="w-20 sm:w-24"
                  />
                  <Button
                    className="flex-1"
                    onClick={handleRequest}
                    disabled={!reqProductId || createRequest.isPending}
                  >
                    Solicitar material
                  </Button>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
