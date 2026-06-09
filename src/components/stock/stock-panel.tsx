"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowDownToLine, ArrowUpFromLine, Search } from "lucide-react";
import { Card, SectionHeading } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QrCode } from "./qr-code";
import { access } from "@/lib/access";
import type { Product, Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/use-app-store";
import { useUIStore } from "@/store/use-ui-store";
import { useProducts, useCreateProduct, useAdjustStock } from "@/hooks/useProducts";

function stockStatus(p: Product) {
  if (p.qty <= p.min * 0.5) return { label: "Critico", pill: "red" as const };
  if (p.qty <= p.min) return { label: "Baixo", pill: "amber" as const };
  return { label: "Ok", pill: "teal" as const };
}

const productSchema = z.object({
  name: z.string().min(2, "Informe o nome"),
  sku: z.string().min(2, "Informe o SKU"),
  category: z.string().min(1, "Informe a categoria"),
  location: z.string().min(1, "Informe a localizacao"),
  qty: z.coerce.number().min(0),
  min: z.coerce.number().min(0),
  cost: z.coerce.number().min(0),
  price: z.coerce.number().min(0),
});
type ProductForm = z.input<typeof productSchema>;

function ProductFormSection({ role }: { role: Role }) {
  const createProduct = useCreateProduct();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: { qty: 0, min: 1, cost: 0, price: 0 },
  });

  if (!access.stockWrite(role)) return null;

  return (
    <form
      onSubmit={handleSubmit((data) => {
        createProduct.mutate(productSchema.parse(data));
        reset({ name: "", sku: "", category: "", location: "", qty: 0, min: 1, cost: 0, price: 0 });
      })}
      className="rounded-[14px] border border-line bg-panel-soft/40 p-4"
    >
      <div className="mb-3">
        <span className="text-xs uppercase text-muted">Cadastro</span>
        <strong className="block text-sm text-ink">Novo produto</strong>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Label>
          Nome
          <Input {...register("name")} />
          {errors.name && <span className="text-[10px] text-red">{errors.name.message}</span>}
        </Label>
        <Label>
          SKU
          <Input {...register("sku")} />
          {errors.sku && <span className="text-[10px] text-red">{errors.sku.message}</span>}
        </Label>
        <Label>
          Categoria
          <Input {...register("category")} />
        </Label>
        <Label>
          Localizacao
          <Input {...register("location")} />
        </Label>
        <Label>
          Quantidade
          <Input type="number" min={0} {...register("qty")} />
        </Label>
        <Label>
          Estoque minimo
          <Input type="number" min={0} {...register("min")} />
        </Label>
        <Label>
          Preco de custo
          <Input type="number" min={0} step="0.01" {...register("cost")} />
        </Label>
        <Label>
          Preco de venda
          <Input type="number" min={0} step="0.01" {...register("price")} />
        </Label>
      </div>
      <Button type="submit" className="mt-3 w-full" disabled={createProduct.isPending}>
        {createProduct.isPending ? "Cadastrando..." : "Cadastrar e gerar QR"}
      </Button>
    </form>
  );
}

function MovementForms({ products }: { products: Product[] }) {
  const role = useAppStore((s) => s.role);
  const adjustStock = useAdjustStock();
  const requests = useAppStore((s) => s.requests);
  const reviewRequest = useAppStore((s) => s.reviewRequest);
  const [entry, setEntry] = useState({ id: "", qty: 1, reason: "" });
  const [exit, setExit] = useState({ id: "", qty: 1, reason: "venda" });
  const [msg, setMsg] = useState("");

  if (!access.stockWrite(role)) return null;

  function findApiId(identifier: string): string | undefined {
    const norm = identifier.trim().toLowerCase();
    const found = products.find(
      (p) => p.sku.toLowerCase() === norm || p.qr.toLowerCase() === norm || String(p.id) === norm,
    );
    return found?._apiId;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2" id="stock-movimento">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const apiId = findApiId(entry.id);
          if (!apiId) { setMsg("Produto nao encontrado."); return; }
          adjustStock.mutate(
            { apiId, quantity: Number(entry.qty), reason: entry.reason || "reposicao" },
            { onSuccess: () => { setMsg("Entrada registrada."); setEntry({ id: "", qty: 1, reason: "" }); } }
          );
        }}
        className="rounded-[14px] border border-line bg-panel-soft/40 p-4"
      >
        <div className="mb-3 flex items-center gap-2">
          <ArrowDownToLine className="size-4 text-teal" />
          <strong className="text-sm text-ink">Entrada</strong>
        </div>
        <div className="flex flex-col gap-2.5">
          <Label>
            SKU ou QR
            <Input value={entry.id} onChange={(e) => setEntry({ ...entry, id: e.target.value })} required />
          </Label>
          <Label>
            Quantidade
            <Input
              type="number"
              min={1}
              value={entry.qty}
              onChange={(e) => setEntry({ ...entry, qty: Number(e.target.value) })}
            />
          </Label>
          <Label>
            Fornecedor / motivo
            <Input value={entry.reason} onChange={(e) => setEntry({ ...entry, reason: e.target.value })} />
          </Label>
          <Button type="submit" disabled={adjustStock.isPending}>Registrar entrada</Button>
        </div>
      </form>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const apiId = findApiId(exit.id);
          if (!apiId) { setMsg("Produto nao encontrado ou estoque insuficiente."); return; }
          adjustStock.mutate(
            { apiId, quantity: -Number(exit.qty), reason: exit.reason },
            { onSuccess: () => { setMsg("Saida registrada."); setExit({ id: "", qty: 1, reason: "venda" }); } }
          );
        }}
        className="rounded-[14px] border border-line bg-panel-soft/40 p-4"
      >
        <div className="mb-3 flex items-center gap-2">
          <ArrowUpFromLine className="size-4 text-amber" />
          <strong className="text-sm text-ink">Saida</strong>
        </div>
        <div className="flex flex-col gap-2.5">
          <Label>
            SKU ou QR
            <Input value={exit.id} onChange={(e) => setExit({ ...exit, id: e.target.value })} required />
          </Label>
          <Label>
            Quantidade
            <Input
              type="number"
              min={1}
              value={exit.qty}
              onChange={(e) => setExit({ ...exit, qty: Number(e.target.value) })}
            />
          </Label>
          <Label>
            Motivo
            <Select value={exit.reason} onValueChange={(v) => setExit({ ...exit, reason: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["venda", "OS", "troca", "perda", "garantia"].map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Label>
          <Button type="submit" disabled={adjustStock.isPending}>Registrar saida</Button>
        </div>
      </form>
      {msg && <p className="md:col-span-2 text-xs text-muted">{msg}</p>}

      <div className="md:col-span-2 rounded-[14px] border border-line bg-panel-soft/40 p-4" id="stock-solicitacoes">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <span className="text-xs uppercase text-muted">Solicitacoes</span>
            <strong className="block text-sm text-ink">Pedidos de material das equipes</strong>
          </div>
          <Badge tone="amber">{requests.filter((r) => r.status === "pendente").length} pendentes</Badge>
        </div>
        <div className="flex flex-col gap-2">
          {requests.length === 0 && <small className="text-muted">Nenhuma solicitacao pendente.</small>}
          {requests.map((r) => (
            <article key={r.id} className="rounded-[10px] border border-line bg-panel p-2.5">
              <strong className="text-sm text-ink">
                {r.qty}x {r.name}
              </strong>
              <small className="block text-xs text-muted">
                {r.os} · {r.status} · {r.when}
              </small>
              {(role === "admin" || role === "estoque") && r.status === "pendente" && (
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => reviewRequest(r.id, "aprovado")}>
                    Aprovar
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => reviewRequest(r.id, "reprovado")}>
                    Reprovar
                  </Button>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

export function StockPanel() {
  const role = useAppStore((s) => s.role);
  const { stockTarget } = useUIStore();
  const { data: products = [], isLoading } = useProducts();
  const [selectedId, setSelectedId] = useState(1);
  const [scan, setScan] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = products.find((p) => p.id === selectedId) ?? products[0];
  const low = products.filter((p) => p.qty <= p.min && p.min > 0);

  useEffect(() => {
    if (products.length > 0 && !products.find((p) => p.id === selectedId)) {
      setSelectedId(products[0].id);
    }
  }, [products, selectedId]);

  useEffect(() => {
    if (stockTarget) {
      document.getElementById(stockTarget)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [stockTarget]);

  function doScan() {
    const norm = scan.trim().toLowerCase();
    const found = products.find(
      (p) => p.sku.toLowerCase() === norm || p.qr.toLowerCase() === norm || String(p.id) === norm,
    );
    if (found) setSelectedId(found.id);
  }

  if (isLoading) {
    return (
      <Card>
        <div className="py-16 text-center text-sm text-muted">Carregando produtos...</div>
      </Card>
    );
  }

  return (
    <Card>
      <div ref={rootRef} />
      <SectionHeading eyebrow="Almoxarifado com QR Code" title="Produtos, entradas, saidas e historico">
        <Badge tone="amber">{low.length} baixos</Badge>
      </SectionHeading>

      {role === "tecnico" && (
        <p className="mb-4 rounded-[10px] bg-teal-soft/60 p-3 text-xs text-teal">
          Tecnico consulta as quantidades disponiveis na central e solicita material para a OS.
          Entrada, saida e cadastro continuam restritos ao estoque e administrador.
        </p>
      )}

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Itens cadastrados", value: products.length },
          { label: "Alertas", value: low.length },
          { label: "Ultimo produto", value: products[0]?.name ?? "-" },
        ].map((m) => (
          <div key={m.label} className="rounded-[12px] border border-line bg-panel-soft/40 p-3">
            <span className="text-xs text-muted">{m.label}</span>
            <strong className="mt-1 block text-lg text-ink">{m.value}</strong>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section id="stock-produtos">
          <div className="mb-3 flex gap-2">
            <Input
              value={scan}
              onChange={(e) => setScan(e.target.value)}
              placeholder="Escaneie QR ou digite SKU"
              onKeyDown={(e) => e.key === "Enter" && doScan()}
            />
            <Button variant="secondary" onClick={doScan}>
              <Search /> Abrir
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {products.map((p) => {
              const status = stockStatus(p);
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-[10px] border border-line bg-panel p-3 text-left transition-colors hover:border-teal/50",
                    p.id === selectedId && "border-teal bg-teal-soft/40",
                  )}
                >
                  <span>
                    <strong className="block text-sm text-ink">{p.name}</strong>
                    <small className="text-xs text-muted">
                      {p.sku} · {p.category} · {p.location}
                    </small>
                  </span>
                  <span className="flex items-center gap-3 text-right">
                    <span>
                      <strong className="block text-sm text-ink">{p.qty}</strong>
                      <small className="text-[11px] text-muted">min. {p.min}</small>
                    </span>
                    <Badge tone={status.pill}>{status.label}</Badge>
                  </span>
                </button>
              );
            })}
            {products.length === 0 && (
              <div className="py-8 text-center text-sm text-muted">
                Nenhum produto cadastrado. Adicione um produto ao lado.
              </div>
            )}
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-2 rounded-[14px] border border-line bg-panel-soft/40 p-4 text-center">
            <span className="self-start text-xs uppercase text-muted">Produto selecionado</span>
            <strong className="self-start text-sm text-ink">{selected?.name ?? "—"}</strong>
            <small className="self-start text-xs text-muted">
              {selected?.sku} · {selected?.location}
            </small>
            {selected && <QrCode value={selected.qr} />}
            <strong className="text-xs text-ink">{selected?.sku}</strong>
          </div>
          <ProductFormSection role={role} />
        </aside>
      </div>

      <div className="mt-4 grid gap-4">
        <MovementForms products={products} />

        <div className="rounded-[14px] border border-line bg-panel-soft/40 p-4">
          <strong className="mb-2 block text-sm text-ink">Estoque baixo</strong>
          <div className="flex flex-col gap-2">
            {low.map((p) => (
              <div key={p.id} className="rounded-[10px] border border-line bg-panel p-2.5">
                <strong className="text-sm text-ink">{p.name}</strong>
                <small className="block text-xs text-muted">
                  {p.qty} atual / minimo {p.min} · {p.location}
                </small>
              </div>
            ))}
            {low.length === 0 && <small className="text-muted">Sem alertas.</small>}
          </div>
        </div>
      </div>
    </Card>
  );
}
