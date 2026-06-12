"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Package,
  Plus,
  QrCode as QrCodeIcon,
  Search,
  X,
} from "lucide-react";
import { Card, SectionHeading } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { useMaterialRequests, useReviewMaterialRequest } from "@/hooks/useMaterialRequests";

/* ── helpers ── */

function stockStatus(p: Product) {
  if (p.qty <= p.min * 0.5) return { label: "Crítico", tone: "red" as const };
  if (p.qty <= p.min)       return { label: "Baixo",   tone: "amber" as const };
  return                           { label: "Ok",       tone: "teal" as const };
}

/* ── schemas ── */

const productSchema = z.object({
  name:     z.string().min(2, "Informe o nome"),
  sku:      z.string().min(2, "Informe o SKU"),
  category: z.string().min(1, "Informe a categoria"),
  location: z.string().min(1, "Informe a localização"),
  qty:      z.coerce.number().min(0),
  min:      z.coerce.number().min(0),
  cost:     z.coerce.number().min(0),
  price:    z.coerce.number().min(0),
});
type ProductForm = z.input<typeof productSchema>;

/* ── Products tab ── */

function ProductsTab({ role }: { role: Role }) {
  const { data: products = [], isLoading } = useProducts();
  const createProduct = useCreateProduct();
  const [search, setSearch]       = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showForm, setShowForm]   = useState(false);
  const [scan, setScan]           = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const { stockTarget } = useUIStore();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: { qty: 0, min: 1, cost: 0, price: 0 },
  });

  const filtered = products.filter((p) =>
    search === "" ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase()),
  );

  const selected = products.find((p) => p.id === selectedId) ?? products[0] ?? null;

  useEffect(() => {
    if (products.length > 0 && selectedId === null) setSelectedId(products[0].id);
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
      <div className="flex flex-col gap-2 py-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-[12px] bg-panel" />
        ))}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto ou SKU..."
              className="pl-8"
            />
          </div>
          <Input
            value={scan}
            onChange={(e) => setScan(e.target.value)}
            placeholder="Escanear QR ou SKU"
            onKeyDown={(e) => e.key === "Enter" && doScan()}
            className="w-40"
          />
          <Button variant="secondary" onClick={doScan} aria-label="Abrir produto por QR ou SKU">
            <QrCodeIcon className="size-4" />
          </Button>
        </div>
        {access.stockWrite(role) && (
          <Button size="sm" onClick={() => setShowForm((s) => !s)}>
            {showForm ? <><X className="size-4" /> Cancelar</> : <><Plus className="size-4" /> Novo produto</>}
          </Button>
        )}
      </div>

      {showForm && access.stockWrite(role) && (
        <form
          onSubmit={handleSubmit((data) => {
            createProduct.mutate(productSchema.parse(data));
            reset({ name: "", sku: "", category: "", location: "", qty: 0, min: 1, cost: 0, price: 0 });
            setShowForm(false);
          })}
          className="rounded-[14px] border border-line bg-panel-soft/50 p-4"
        >
          <strong className="mb-3 block text-sm text-ink">Novo produto</strong>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
              Localização
              <Input {...register("location")} />
            </Label>
            <Label>
              Quantidade
              <Input type="number" min={0} {...register("qty")} />
            </Label>
            <Label>
              Estoque mínimo
              <Input type="number" min={0} {...register("min")} />
            </Label>
            <Label>
              Preço de custo
              <Input type="number" min={0} step="0.01" {...register("cost")} />
            </Label>
            <Label>
              Preço de venda
              <Input type="number" min={0} step="0.01" {...register("price")} />
            </Label>
          </div>
          <Button type="submit" className="mt-3" disabled={createProduct.isPending}>
            {createProduct.isPending ? "Cadastrando..." : "Cadastrar produto"}
          </Button>
        </form>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_260px]" id="stock-produtos">
        <div className="flex flex-col gap-1.5">
          {filtered.map((p) => {
            const st = stockStatus(p);
            return (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-[12px] border border-line bg-panel p-3 text-left transition-all hover:border-teal/40",
                  p.id === selectedId && "border-teal bg-teal-soft/30",
                )}
              >
                <span className="min-w-0">
                  <strong className="block truncate text-sm text-ink">{p.name}</strong>
                  <small className="text-xs text-muted">
                    {p.sku} · {p.category} · {p.location}
                  </small>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-right">
                    <strong className="block text-sm text-ink">{p.qty}</strong>
                    <small className="text-[10px] text-muted">min. {p.min}</small>
                  </span>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </span>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <EmptyState
              icon={<Package className="size-5" />}
              title="Nenhum produto encontrado"
              description={search ? "Tente outros termos de busca." : "Cadastre o primeiro produto."}
            />
          )}
        </div>

        {selected && (
          <aside className="flex flex-col items-center gap-3 rounded-[14px] border border-line bg-panel-soft/40 p-4 text-center">
            <span className="self-start text-xs uppercase tracking-widest text-muted">Produto selecionado</span>
            <strong className="self-start text-sm text-ink">{selected.name}</strong>
            <small className="self-start text-xs text-muted">
              {selected.sku} · {selected.location}
            </small>
            <QrCode value={selected.qr} />
            <Badge tone={stockStatus(selected).tone}>{stockStatus(selected).label}</Badge>
          </aside>
        )}
      </div>
    </div>
  );
}

/* ── Movement form ── */

function MovementTab({ products, direction }: { products: Product[]; direction: "entrada" | "saida" }) {
  const role = useAppStore((s) => s.role);
  const adjustStock = useAdjustStock();
  const [identifier, setIdentifier] = useState("");
  const [qty, setQty]               = useState(1);
  const [reason, setReason]         = useState(direction === "saida" ? "venda" : "");
  const [msg, setMsg]               = useState("");

  if (!access.stockWrite(role)) {
    return (
      <EmptyState
        icon={<Package className="size-5" />}
        title="Acesso restrito"
        description="Apenas administrador e almoxarife podem registrar movimentações."
      />
    );
  }

  function findApiId(id: string) {
    const norm = id.trim().toLowerCase();
    return products.find(
      (p) => p.sku.toLowerCase() === norm || p.qr.toLowerCase() === norm || String(p.id) === norm,
    )?._apiId;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const apiId = findApiId(identifier);
    if (!apiId) { setMsg("Produto não encontrado."); return; }
    const delta = direction === "entrada" ? qty : -qty;
    adjustStock.mutate(
      { apiId, quantity: Number(delta), reason: reason || (direction === "entrada" ? "reposição" : "venda") },
      {
        onSuccess: () => {
          setMsg(`${direction === "entrada" ? "Entrada" : "Saída"} registrada.`);
          setIdentifier(""); setQty(1); setReason(direction === "saida" ? "venda" : "");
        },
        onError: () => setMsg("Erro ao registrar movimentação."),
      },
    );
  }

  const Icon = direction === "entrada" ? ArrowDownToLine : ArrowUpFromLine;
  const label = direction === "entrada" ? "Entrada de estoque" : "Saída de estoque";
  const iconColor = direction === "entrada" ? "text-teal" : "text-amber";

  return (
    <div className="max-w-sm" id="stock-movimento">
      <form onSubmit={handleSubmit} className="rounded-[14px] border border-line bg-panel-soft/40 p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={cn("size-4", iconColor)} />
          <strong className="text-sm text-ink">{label}</strong>
        </div>

        <Label>
          SKU ou QR Code
          <Input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Digite ou escaneie o código"
            required
          />
        </Label>

        <Label>
          Quantidade
          <Input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
          />
        </Label>

        {direction === "entrada" ? (
          <Label>
            Fornecedor / motivo
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Opcional" />
          </Label>
        ) : (
          <Label>
            Motivo
            <Select value={reason} onValueChange={(v) => setReason(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["venda", "OS", "troca", "perda", "garantia"].map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Label>
        )}

        <Button type="submit" className="w-full" disabled={adjustStock.isPending}>
          {adjustStock.isPending ? "Registrando..." : `Confirmar ${direction}`}
        </Button>
        {msg && <p className="text-xs text-muted">{msg}</p>}
      </form>
    </div>
  );
}

/* ── Requests tab ── */

function RequestsTab() {
  const role = useAppStore((s) => s.role);
  const { data: requests = [], isLoading } = useMaterialRequests();
  const reviewRequest = useReviewMaterialRequest();

  const pending = requests.filter((r) => r.status === "PENDING");

  if (isLoading) {
    return <div className="h-32 animate-pulse rounded-[12px] bg-panel" />;
  }

  if (requests.length === 0) {
    return (
      <EmptyState
        icon={<Package className="size-5" />}
        title="Nenhuma solicitação"
        description="Quando técnicos solicitarem material para uma OS, aparecerá aqui."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2" id="stock-solicitacoes">
      {pending.length > 0 && (
        <div className="mb-1 flex items-center gap-2">
          <Badge tone="amber">{pending.length} pendente{pending.length > 1 ? "s" : ""}</Badge>
        </div>
      )}
      {requests.map((r) => (
        <article key={r.id} className="rounded-[12px] border border-line bg-panel p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <strong className="text-sm text-ink">
                {r.quantity}x {r.product?.name ?? r.productId}
              </strong>
              <small className="block text-xs text-muted">
                OS #{r.serviceOrder?.number ?? r.serviceOrderId} · {new Date(r.createdAt).toLocaleDateString("pt-BR")}
              </small>
            </div>
            <Badge tone={r.status === "PENDING" ? "amber" : r.status === "APPROVED" ? "teal" : "red"}>
              {r.status === "PENDING" ? "Pendente" : r.status === "APPROVED" ? "Aprovado" : "Reprovado"}
            </Badge>
          </div>
          {(role === "admin" || role === "estoque") && r.status === "PENDING" && (
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => reviewRequest.mutate({ id: r.id, status: "APPROVED" })}>
                Aprovar
              </Button>
              <Button size="sm" variant="danger" onClick={() => reviewRequest.mutate({ id: r.id, status: "REJECTED" })}>
                Reprovar
              </Button>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

/* ── Alerts tab ── */

function AlertsTab({ products }: { products: Product[] }) {
  const low = products.filter((p) => p.qty <= p.min && p.min > 0);

  if (low.length === 0) {
    return (
      <EmptyState
        icon={<AlertTriangle className="size-5" />}
        title="Nenhum alerta de estoque"
        description="Quando houver itens abaixo do mínimo, eles aparecerão aqui."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {low.map((p) => {
        const st = stockStatus(p);
        return (
          <article key={p.id} className="flex items-center justify-between gap-3 rounded-[12px] border border-red/20 bg-red-soft/10 p-3">
            <div>
              <strong className="text-sm text-ink">{p.name}</strong>
              <small className="block text-xs text-muted">
                Atual: {p.qty} · Mínimo: {p.min} · {p.location}
              </small>
            </div>
            <Badge tone={st.tone}>{st.label}</Badge>
          </article>
        );
      })}
    </div>
  );
}

/* ── StockPanel ── */

export function StockPanel() {
  const role = useAppStore((s) => s.role);
  const { data: products = [], isLoading } = useProducts();
  const low = products.filter((p) => p.qty <= p.min && p.min > 0);

  return (
    <Card>
      <SectionHeading eyebrow="Almoxarifado e QR Code" title="Estoque">
        {low.length > 0 && (
          <Badge tone="red">{low.length} alerta{low.length > 1 ? "s" : ""}</Badge>
        )}
      </SectionHeading>

      <div className="mb-4 grid grid-cols-3 gap-3">
        {[
          { label: "Itens cadastrados", value: products.length },
          { label: "Alertas de estoque",   value: low.length },
          { label: "Último produto",    value: products[0]?.name ?? "—" },
        ].map((m) => (
          <div key={m.label} className="rounded-[12px] border border-line bg-panel-soft/40 p-3">
            <span className="text-xs text-muted">{m.label}</span>
            <strong className="mt-1 block text-lg text-ink">{m.value}</strong>
          </div>
        ))}
      </div>

      <Tabs defaultValue="produtos">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="entradas">Entradas</TabsTrigger>
          <TabsTrigger value="saidas">Saídas</TabsTrigger>
          <TabsTrigger value="solicitacoes">
            Solicitações
            {/* badge count is shown in tab content */}
          </TabsTrigger>
          <TabsTrigger value="alertas">
            Alertas {low.length > 0 && `(${low.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="produtos">
          {isLoading ? (
            <div className="flex flex-col gap-2 py-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-[12px] bg-panel" />
              ))}
            </div>
          ) : (
            <ProductsTab role={role} />
          )}
        </TabsContent>

        <TabsContent value="entradas">
          <MovementTab products={products} direction="entrada" />
        </TabsContent>

        <TabsContent value="saidas">
          <MovementTab products={products} direction="saida" />
        </TabsContent>

        <TabsContent value="solicitacoes">
          <RequestsTab />
        </TabsContent>

        <TabsContent value="alertas">
          <AlertsTab products={products} />
        </TabsContent>
      </Tabs>
    </Card>
  );
}
