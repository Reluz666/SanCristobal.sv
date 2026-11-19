import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Warehouse,
} from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchInventorySummary,
  fetchKardex,
  fetchProducts,
  fetchWarehouses,
} from "@/features/pos/api";
import { formatMoney, formatQuantity } from "@/lib/currency";
import { formatDateTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import type { KardexMovement } from "@/types/pos";

const ALL = "all";

const MOVEMENT_TYPES = [
  "IN_INITIAL",
  "IN_PURCHASE",
  "OUT_SALE",
  "IN_RETURN",
  "OUT_RETURN",
  "ADJUSTMENT_IN",
  "ADJUSTMENT_OUT",
] as const;

const MOVEMENT_LABELS: Record<string, string> = {
  IN_INITIAL: "Saldo Inicial",
  IN_PURCHASE: "Compra",
  OUT_SALE: "Venta POS",
  IN_RETURN: "Devolución Cliente",
  OUT_RETURN: "Devolución Proveedor",
  ADJUSTMENT_IN: "Ajuste Ingreso",
  ADJUSTMENT_OUT: "Ajuste Salida",
};

export function KardexPage() {
  const [productUuid, setProductUuid] = React.useState(ALL);
  const [warehouseUuid, setWarehouseUuid] = React.useState(ALL);
  const [movementType, setMovementType] = React.useState(ALL);
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [perPage, setPerPage] = React.useState("25");
  const [page, setPage] = React.useState(1);

  const productsQuery = useQuery({
    queryKey: ["pos", "products", "__kardex"],
    queryFn: () => fetchProducts(""),
  });

  const warehousesQuery = useQuery({
    queryKey: ["inventory", "warehouses"],
    queryFn: fetchWarehouses,
  });

  const inventorySummaryQuery = useQuery({
    queryKey: ["inventory", "summary"],
    queryFn: fetchInventorySummary,
  });

  const kardexQuery = useQuery({
    queryKey: [
      "inventory",
      "kardex",
      productUuid,
      warehouseUuid,
      movementType,
      dateFrom,
      dateTo,
      perPage,
      page,
    ],
    queryFn: () =>
      fetchKardex({
        product_uuid: productUuid === ALL ? undefined : productUuid,
        warehouse_uuid: warehouseUuid === ALL ? undefined : warehouseUuid,
        movement_type: movementType === ALL ? undefined : movementType,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        per_page: Number(perPage),
        page,
      }),
    placeholderData: keepPreviousData,
  });

  const rows = kardexQuery.data?.rows ?? [];
  const pagination = kardexQuery.data?.pagination;
  const products = productsQuery.data?.products ?? [];
  const inventorySummary = inventorySummaryQuery.data;

  const resetFilters = (): void => {
    setProductUuid(ALL);
    setWarehouseUuid(ALL);
    setMovementType(ALL);
    setDateFrom("");
    setDateTo("");
    setPerPage("25");
    setPage(1);
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <PageHeader
        section="Gestión de Almacén"
        title="Inventario y Kardex Físico-Valorizado"
        description="Control de existencias mediante costo promedio ponderado (CPP) y SUNAT Formato 13.1."
        meta={
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs font-semibold text-primary">
              <Boxes className="size-3" />
              SUNAT 13.1
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              {pagination?.total ?? 0} movimientos registrados
            </span>
          </>
        }
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void kardexQuery.refetch();
              void inventorySummaryQuery.refetch();
            }}
            disabled={kardexQuery.isFetching || inventorySummaryQuery.isFetching}
            className="rounded-xl cursor-pointer font-medium text-xs hover:border-primary"
          >
            <RefreshCw
              className={cn("size-3.5 mr-1.5", kardexQuery.isFetching && "animate-spin")}
              strokeWidth={1.8}
            />
            Actualizar
          </Button>
        }
      />

      {/* KPI Inventory Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border/70 bg-card p-4.5 shadow-xs space-y-1">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
            Valor potencial a precio de venta
          </span>
          <div className="font-mono text-2xl font-bold tracking-tight text-foreground">
            {inventorySummaryQuery.isLoading
              ? "Cargando..."
              : inventorySummaryQuery.isError
                ? "No disponible"
                : formatMoney(inventorySummary?.retail_value ?? "0.00")}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {inventorySummaryQuery.isLoading
              ? "Cargando existencias..."
              : inventorySummaryQuery.isError
                ? "No se pudo cargar el resumen"
                : `${formatQuantity(inventorySummary?.total_units ?? "0")} bultos/unidades en existencias`}
          </p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-4.5 shadow-xs space-y-1">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
            Catálogo Activo
          </span>
          <div className="font-mono text-2xl font-bold tracking-tight text-primary">
            {inventorySummaryQuery.isLoading
              ? "Cargando..."
              : inventorySummaryQuery.isError
                ? "No disponible"
                : `${inventorySummary?.active_products_count ?? 0} productos`}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {inventorySummaryQuery.isLoading
              ? "Consultando existencias"
              : inventorySummaryQuery.isError
                ? "No se pudo cargar el resumen"
                : (inventorySummary?.low_stock_count ?? 0) > 0
                  ? `${inventorySummary?.low_stock_count} artículos con stock bajo`
                  : "Nivel de stock óptimo"}
          </p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-4.5 shadow-xs space-y-1">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
            Almacén del resumen
          </span>
          <div className="flex items-center gap-2 mt-1">
            <Warehouse className="size-5 text-primary" />
            <span className="font-mono text-base font-semibold text-foreground truncate">
              {inventorySummaryQuery.isLoading
                ? "Cargando..."
                : inventorySummaryQuery.isError
                  ? "No disponible"
                  : inventorySummary?.warehouse?.name ?? "Sin almacén activo"}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">Indicadores del catálogo completo</p>
        </div>
      </div>

      {/* Filter Dock */}
      <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-xs space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {/* Product Select */}
          <div className="lg:col-span-2">
            <Select
              value={productUuid}
              onValueChange={(val) => {
                setProductUuid(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 text-xs rounded-xl bg-background">
                <SelectValue placeholder="Seleccionar producto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos los productos</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.uuid} value={p.uuid}>
                    {p.name} ({p.unit_code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Warehouse Select */}
          <Select
            value={warehouseUuid}
            onValueChange={(val) => {
              setWarehouseUuid(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 text-xs rounded-xl bg-background">
              <SelectValue placeholder="Almacén" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los almacenes</SelectItem>
              {(warehousesQuery.data ?? []).map((w) => (
                <SelectItem key={w.uuid} value={w.uuid}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Movement Type Select */}
          <Select
            value={movementType}
            onValueChange={(val) => {
              setMovementType(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 text-xs rounded-xl bg-background">
              <SelectValue placeholder="Tipo de movimiento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los movimientos</SelectItem>
              {MOVEMENT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {MOVEMENT_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date from / to */}
          <div className="flex items-center gap-1.5 lg:col-span-2">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="h-9 text-xs rounded-xl bg-background font-mono"
              title="Fecha inicial"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="h-9 text-xs rounded-xl bg-background font-mono"
              title="Fecha final"
            />
          </div>
        </div>

        {(productUuid !== ALL || warehouseUuid !== ALL || movementType !== ALL || dateFrom || dateTo) && (
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-muted-foreground hover:text-primary font-medium transition-colors cursor-pointer"
            >
              Limpiar todos los filtros
            </button>
          </div>
        )}
      </div>

      {/* Modern Kardex Movements Table */}
      <div className="rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/50 p-4 bg-muted/10">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Movimientos en Kardex
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {pagination
              ? `${String(pagination.from ?? 0)}-${String(pagination.to ?? 0)} de ${String(pagination.total)}`
              : "--"}
          </span>
        </div>

        <div className="divide-y divide-border/40">
          {kardexQuery.isLoading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              <RefreshCw className="size-5 animate-spin mx-auto mb-2 text-primary" />
              Cargando movimientos de Kardex...
            </div>
          ) : kardexQuery.isError ? (
            <div className="p-8 text-center text-xs text-red-500">
              Error al consultar los movimientos del inventario.
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground text-sm">Sin movimientos para los filtros aplicados</p>
              <p>Cada venta o ingreso de mercadería genera automáticamente un registro aquí.</p>
            </div>
          ) : (
            rows.map((m: KardexMovement) => {
              const isOut = m.is_outbound;

              return (
                <div
                  key={m.uuid}
                  className="flex flex-wrap items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/20"
                >
                  {/* Left: Product & Document */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-2xl font-mono text-xs font-bold",
                      isOut
                        ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    )}>
                      {isOut ? <ArrowUpRight className="size-5" /> : <ArrowDownLeft className="size-5" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-foreground truncate max-w-[240px]">
                          {m.product.name}
                        </span>
                        <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                          {m.product.sku}
                        </span>
                      </div>

                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {m.document_reference ? `Doc: ${m.document_reference}` : m.warehouse.name}
                        </span>
                        <span>•</span>
                        <span className="font-mono text-[11px]">
                          {m.movement_date ? formatDateTime(m.movement_date) : "Sin fecha"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Quantity, Cost & Balances */}
                  <div className="flex items-center gap-6">
                    {/* Quantity moved */}
                    <div className="text-right">
                      <span className="text-[10px] text-muted-foreground uppercase block font-sans">
                        {isOut ? "Salida" : "Entrada"}
                      </span>
                      <span className={cn("font-mono text-sm font-bold", isOut ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400")}>
                        {isOut ? "-" : "+"}{formatQuantity(m.quantity)}
                      </span>
                    </div>

                    {/* Unit Cost */}
                    <div className="text-right hidden sm:block">
                      <span className="text-[10px] text-muted-foreground uppercase block font-sans">
                        Costo Unit.
                      </span>
                      <span className="font-mono text-xs font-semibold text-foreground">
                        {formatMoney(m.unit_cost, { scale: 2 })}
                      </span>
                    </div>

                    {/* Balance Quantity */}
                    <div className="text-right">
                      <span className="text-[10px] text-muted-foreground uppercase block font-sans">
                        Saldo Físico
                      </span>
                      <span className="font-mono text-sm font-bold text-foreground">
                        {formatQuantity(m.balance_quantity)}
                      </span>
                    </div>

                    {/* Balance Value */}
                    <div className="text-right min-w-[90px]">
                      <span className="text-[10px] text-muted-foreground uppercase block font-sans">
                        Saldo Valorizado
                      </span>
                      <span className="font-mono text-sm font-extrabold text-primary">
                        {formatMoney(m.balance_total_cost)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between border-t border-border/50 p-4 bg-muted/10">
          <span className="font-mono text-xs text-muted-foreground">
            Página {pagination?.current_page ?? 1} de {pagination?.last_page ?? 1}
          </span>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={(pagination?.current_page ?? 1) <= 1 || kardexQuery.isFetching}
              onClick={() => setPage((curr) => Math.max(1, curr - 1))}
              className="rounded-xl cursor-pointer"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={(pagination?.current_page ?? 1) >= (pagination?.last_page ?? 1) || kardexQuery.isFetching}
              onClick={() => setPage((curr) => curr + 1)}
              className="rounded-xl cursor-pointer"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
