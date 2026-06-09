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
import { TEAMS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/use-app-store";
import { useHydrated } from "@/hooks/use-hydrated";

const PHOTO_SLOTS = [
  { slot: "1", label: "Antes" },
  { slot: "2", label: "Durante" },
  { slot: "3", label: "Depois" },
];

export default function TecnicoPage() {
  const hydrated = useHydrated();
  const activeTeam = useAppStore((s) => s.activeTeam);
  const setActiveTeam = useAppStore((s) => s.setActiveTeam);
  const orders = useAppStore((s) => s.orders);
  const products = useAppStore((s) => s.products);
  const checkinDone = useAppStore((s) => s.checkinDone);
  const photos = useAppStore((s) => s.photos);
  const signature = useAppStore((s) => s.signature);
  const chipId = useAppStore((s) => s.chipId);
  const setCheckin = useAppStore((s) => s.setCheckin);
  const savePhoto = useAppStore((s) => s.savePhoto);
  const saveSignature = useAppStore((s) => s.saveSignature);
  const clearSignature = useAppStore((s) => s.clearSignature);
  const verifyChip = useAppStore((s) => s.verifyChip);
  const completeOrder = useAppStore((s) => s.completeOrder);
  const createRequest = useAppStore((s) => s.createRequest);

  const fileRef = useRef<HTMLInputElement>(null);
  const targetSlot = useRef<string>("3");
  const [chipDraft, setChipDraft] = useState("");
  const [reqProduct, setReqProduct] = useState(products[0]?.name ?? "");
  const [reqQty, setReqQty] = useState(1);

  if (!hydrated) {
    return <div className="grid min-h-screen place-items-center text-muted">Carregando...</div>;
  }

  const teamOrders = orders.filter((o) => o.team === activeTeam);
  const activeOrder = teamOrders.find((o) => o.status !== "completed") ?? teamOrders[0];
  const photoCount = PHOTO_SLOTS.filter((p) => photos[p.slot]).length;
  const chipOk = !!chipId && chipId.replace(/\D/g, "").length >= 10;
  const requirements = [
    { key: "checkin", label: "Iniciar atendimento", done: checkinDone },
    { key: "photos", label: "3 fotos", done: photoCount >= 3 },
    { key: "signature", label: "Assinatura", done: !!signature },
    { key: "chip", label: "ID do chip", done: chipOk },
  ];
  const canFinish = requirements.every((r) => r.done) && activeOrder?.status !== "completed";

  function pickPhoto(slot: string) {
    targetSlot.current = slot;
    fileRef.current?.click();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => savePhoto(targetSlot.current, reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
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
          <strong className="block text-sm text-ink">Minhas OS</strong>
        </div>
        <Select value={activeTeam} onValueChange={setActiveTeam}>
          <SelectTrigger className="h-9 w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TEAMS.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      <div className="flex flex-col gap-4 p-4">
        <section className="grid grid-cols-4 gap-2">
          {[
            { label: "OS do dia", value: teamOrders.length },
            { label: "Pendentes", value: teamOrders.filter((o) => o.status !== "completed").length },
            { label: "Concluidas", value: teamOrders.filter((o) => o.status === "completed").length },
            { label: "Tempo medio", value: "1h42" },
          ].map((s) => (
            <div key={s.label} className="rounded-[12px] border border-line bg-panel-soft/40 p-2.5 text-center">
              <strong className="block text-lg text-ink">{s.value}</strong>
              <span className="text-[10px] text-muted">{s.label}</span>
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-2">
          <strong className="text-sm text-ink">Ordens de servico</strong>
          {teamOrders.map((o) => {
            const label = orderLabel(o);
            return (
              <article
                key={o.code}
                className={cn(
                  "rounded-[12px] border border-line bg-panel-soft/40 p-3",
                  o.code === activeOrder?.code && "border-teal bg-teal-soft/40",
                )}
              >
                <Badge tone={label.pill}>{label.text}</Badge>
                <strong className="mt-1 block text-sm text-ink">{o.code}</strong>
                <small className="text-xs text-muted">
                  {o.client} · {o.time} · {o.status === "completed" ? "Finalizada" : "Em aberto"}
                </small>
              </article>
            );
          })}
          {teamOrders.length === 0 && (
            <p className="py-6 text-center text-sm text-muted">Nenhuma OS para {activeTeam}.</p>
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
                <Badge tone={orderLabel(activeOrder).pill}>{orderLabel(activeOrder).text}</Badge>
                <strong className="text-sm text-ink">{activeOrder.code}</strong>
              </div>
              <h2 className="mt-1 text-lg font-bold text-ink">{activeOrder.client}</h2>
              <p className="text-sm text-muted">{activeOrder.description}</p>
              <div className="mt-3 flex gap-2">
                <Button variant="secondary" size="sm" className="flex-1" asChild>
                  <a href="tel:+551140001000">
                    <Phone /> Ligar
                  </a>
                </Button>
                <Button variant="secondary" size="sm" className="flex-1" asChild>
                  <a
                    href="https://www.google.com/maps/search/?api=1&query=Rua%20das%20Flores%20120"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MapPin /> Rota
                  </a>
                </Button>
              </div>
              <Button
                className="mt-3 w-full"
                disabled={checkinDone}
                onClick={setCheckin}
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
                {PHOTO_SLOTS.map((p) => (
                  <button
                    key={p.slot}
                    onClick={() => pickPhoto(p.slot)}
                    className="relative grid aspect-square place-items-center overflow-hidden rounded-[10px] border border-dashed border-line bg-panel"
                  >
                    {photos[p.slot] && photos[p.slot].startsWith("data:") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photos[p.slot]} alt={p.label} className="absolute inset-0 size-full object-cover" />
                    ) : photos[p.slot] ? (
                      <CheckCircle2 className="size-6 text-teal" />
                    ) : (
                      <Camera className="size-5 text-muted" />
                    )}
                    <span className="absolute bottom-1 text-[10px] font-semibold text-ink/80">{p.label}</span>
                  </button>
                ))}
              </div>

              <SignaturePad value={signature} onConfirm={saveSignature} onClear={clearSignature} />

              <div className="mt-3 rounded-[12px] border border-line bg-panel p-3">
                <Label>
                  ID CHIP
                  <Input
                    value={chipDraft}
                    onChange={(e) => setChipDraft(e.target.value)}
                    placeholder="8955 0400 1234 5678 9012"
                  />
                </Label>
                <Button
                  variant="secondary"
                  className="mt-2 w-full"
                  onClick={() => verifyChip(chipDraft)}
                >
                  <BadgeCheck /> Confirmar ID do chip
                </Button>
                <small className={cn("mt-1 block text-xs", chipOk ? "text-teal" : "text-muted")}>
                  {chipOk ? `ID do chip confirmado: ${chipId}` : "ID do chip pendente"}
                </small>
              </div>

              <Button
                className="mt-3 w-full"
                disabled={!canFinish}
                onClick={() => completeOrder(activeOrder.code)}
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
                <Select value={reqProduct} onValueChange={setReqProduct}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.name}>
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
                    className="w-24"
                  />
                  <Button
                    className="flex-1"
                    onClick={() => createRequest({ name: reqProduct, qty: reqQty })}
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
