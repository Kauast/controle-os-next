import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";
import type { Product } from "@/lib/types";

interface ApiProduct {
  id: string;
  name: string;
  sku: string;
  description?: string;
  category: string;
  location: string;
  stockQuantity: number;
  minStock: number;
  cost: number | string;
  price: number | string;
}

function toFrontendProduct(p: ApiProduct, index: number): Product {
  return {
    id: index + 1,
    _apiId: p.id,
    name: p.name,
    sku: p.sku,
    category: p.category || "Geral",
    location: p.location || "—",
    qty: p.stockQuantity,
    min: p.minStock,
    cost: Number(p.cost),
    price: Number(p.price),
    qr: `PROD:${p.sku.toUpperCase()}`,
  } as Product & { _apiId: string };
}

interface ProductsResponse {
  products: ApiProduct[];
  total: number;
  totalPages: number;
}

interface CreateProductData {
  name: string;
  sku: string;
  category?: string;
  location?: string;
  qty: number;
  min: number;
  cost: number;
  price: number;
}

interface AdjustStockData {
  apiId: string;
  quantity: number;
  reason: string;
}

export function useProducts(search?: string) {
  return useQuery({
    queryKey: ["products", search],
    queryFn: async () => {
      const { data } = await apiClient.get<ProductsResponse>("/products", {
        params: { limit: 200, search },
      });
      return data.products.map(toFrontendProduct);
    },
  });
}

export function useLowStockProducts() {
  return useQuery({
    queryKey: ["products-low-stock"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiProduct[]>("/products/low-stock");
      return data.map(toFrontendProduct);
    },
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateProductData) => {
      const { data } = await apiClient.post<ApiProduct>("/products", {
        name: input.name,
        sku: input.sku,
        category: input.category || "",
        location: input.location || "",
        stockQuantity: input.qty,
        minStock: input.min,
        cost: input.cost,
        price: input.price,
      });
      return data;
    },
    onSuccess: () => {
      toast.success("Produto cadastrado com sucesso.");
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao cadastrar produto.");
    },
  });
}

export function useAdjustStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ apiId, quantity, reason }: AdjustStockData) => {
      const { data } = await apiClient.patch(`/products/${apiId}/stock`, { quantity, reason });
      return data;
    },
    onSuccess: () => {
      toast.success("Estoque atualizado.");
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao atualizar estoque.");
    },
  });
}
