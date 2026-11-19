import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Barcode,
  Droplets,
  Grid2X2,
  Layers,
  LayoutGrid,
  List,
  Minus,
  Package,
  PackageSearch,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Snowflake,
  Trash2,
  UserRound,
  Volume2,
  VolumeX,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckoutModal } from "@/features/pos/CheckoutModal";
import { CustomerDialog } from "@/features/pos/CustomerDialog";
import { ThermalTicketDialog } from "@/features/pos/ThermalTicketDialog";
import { calculateCart } from "@/features/pos/calculations";
import {
  DOCUMENT_TYPE_LABELS,
  fetchCurrentCashSession,
  fetchPosWarehouses,
  fetchProducts,
} from "@/features/pos/api";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { usePosHotkeys } from "@/hooks/usePosHotkeys";
import { formatMoney, formatQuantity } from "@/lib/currency";
import { decimal } from "@/lib/decimal";
import { isSoundEnabled, playSound, setSoundEnabled } from "@/lib/sound";
import { usePosStore } from "@/stores/posStore";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";
import type { DocumentType, PosProduct } from "@/types/pos";

const DOCUMENT_TYPES: DocumentType[] = ["03", "01", "00"];

function isIdentifiedCustomer(type: string | undefined, documentNumber: string | undefined): boolean {
  return (
    type !== undefined &&
    documentNumber !== undefined &&
    ["1", "6"].includes(type) &&
    documentNumber !== "00000000"
  );
}

function getCategoryBadge(categoryName?: string, unitCode?: string): {
  label: string;
  className: string;
  icon: LucideIcon;
} {
  const cat = (categoryName ?? "").toLowerCase();
  const unit = (unitCode ?? "").toUpperCase();

  if (cat.includes("papel")) {
    const isFardo = unit === "BE" || cat.includes("fardo");
    return {
      label: isFardo ? "Fardo x40" : "Pqte x6",
      className: "bg-primary/10 text-primary border border-primary/20",
      icon: Layers,
    };
  }

  if (cat.includes("agua")) {
    const isRecarga = cat.includes("recarga");
    return {
      label: isRecarga ? "Recarga 20L" : "Bidón 20L",
      className: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20",
      icon: Droplets,
    };
  }

  if (cat.includes("servilleta")) {
    const isCaja = unit === "BX" || unit === "BE";
    return {
      label: isCaja ? "Caja / Fardo" : "Paquete",
      className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20",
      icon: Grid2X2,
    };
  }

  if (cat.includes("hielo")) {
    return {
      label: "Bolsa Hielo",
      className: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/20",
      icon: Snowflake,
    };
  }

  return {
    label: unitCode || "Unidad",
    className: "bg-muted text-muted-foreground border border-border",
    icon: Package,
  };
}

export function PosTerminalPage() {
  const cashSessionsEnabled = useAuthStore((state) => state.company?.features.cash_sessions_enabled ?? false);
  const [searchParams, setSearchParams] = useSearchParams();
  const documentType = usePosStore((state) => state.documentType);
  const setDocumentType = usePosStore((state) => state.setDocumentType);
  const selectedWarehouseUuid = usePosStore((state) => state.warehouseUuid);
  const setSelectedWarehouseUuid = usePosStore((state) => state.setWarehouseUuid);
  const customer = usePosStore((state) => state.customer);
  const setCustomer = usePosStore((state) => state.setCustomer);
  const lines = usePosStore((state) => state.lines);
  const addProduct = usePosStore((state) => state.addProduct);
  const setQuantity = usePosStore((state) => state.setQuantity);
  const increment = usePosStore((state) => state.increment);
  const decrement = usePosStore((state) => state.decrement);
  const removeProduct = usePosStore((state) => state.removeProduct);
  const clearCart = usePosStore((state) => state.clearCart);
  const lastTicket = usePosStore((state) => state.lastTicket);
  const dismissLastTicket = usePosStore((state) => state.dismissLastTicket);

  const [search, setSearch] = React.useState("");
  const deferredSearch = React.useDeferredValue(search);
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<"bento" | "table">("bento");
  const [soundOn, setSoundOn] = React.useState(isSoundEnabled());
  const [checkoutOpen, setCheckoutOpen] = React.useState(false);
  const [manualCustomerOpen, setManualCustomerOpen] = React.useState(false);
  const customerRequestedByUrl = searchParams.get("cliente") === "1";
  const customerOpen = manualCustomerOpen || customerRequestedByUrl;
  const ticketOpen = Boolean(lastTicket);

  const setCustomerOpen = (open: boolean): void => {
    setManualCustomerOpen(open);

    if (!open && customerRequestedByUrl) {
      const next = new URLSearchParams(searchParams);
      next.delete("cliente");
      setSearchParams(next, { replace: true });
    }
  };

  const sessionQuery = useQuery({
    queryKey: ["pos", "cash-session"],
    queryFn: fetchCurrentCashSession,
    enabled: cashSessionsEnabled,
    staleTime: 15_000,
  });

  const session = sessionQuery.data ?? null;

  const warehousesQuery = useQuery({
    queryKey: ["pos", "warehouses"],
    queryFn: fetchPosWarehouses,
    enabled: !cashSessionsEnabled,
    staleTime: 60_000,
  });
  const activeWarehouses = warehousesQuery.data ?? [];
  const selectedWarehouseIsActive = activeWarehouses.some(
    (candidate) => candidate.uuid === selectedWarehouseUuid,
  );
  const effectiveWarehouseUuid = cashSessionsEnabled
    ? undefined
    : selectedWarehouseIsActive
      ? selectedWarehouseUuid ?? undefined
      : selectedWarehouseUuid === null && activeWarehouses.length === 1
        ? activeWarehouses[0]?.uuid
        : undefined;
  const warehouseSelectionRequired =
    !cashSessionsEnabled && activeWarehouses.length > 1 && effectiveWarehouseUuid === undefined;

  React.useEffect(() => {
    if (
      !cashSessionsEnabled &&
      warehousesQuery.isSuccess &&
      selectedWarehouseUuid !== null &&
      !selectedWarehouseIsActive &&
      lines.length === 0
    ) {
      setSelectedWarehouseUuid(null);
    }
  }, [
    cashSessionsEnabled,
    lines.length,
    selectedWarehouseIsActive,
    selectedWarehouseUuid,
    setSelectedWarehouseUuid,
    warehousesQuery.isSuccess,
  ]);

  const productsQuery = useQuery({
    queryKey: ["pos", "products", deferredSearch, effectiveWarehouseUuid],
    queryFn: () => fetchProducts(deferredSearch, effectiveWarehouseUuid),
    enabled: cashSessionsEnabled || effectiveWarehouseUuid !== undefined,
  });

  const totals = React.useMemo(() => calculateCart(lines), [lines]);
  const { inputRef, focusInput } = useBarcodeScanner({ enabled: true });

  const queriedProducts = productsQuery.data?.products;
  const rawProducts = React.useMemo(() => queriedProducts ?? [], [queriedProducts]);
  const products = React.useMemo(() => {
    if (!selectedCategory) {
      return rawProducts;
    }
    return rawProducts.filter(
      (product) => product.category?.name?.toLowerCase() === selectedCategory.toLowerCase(),
    );
  }, [rawProducts, selectedCategory]);

  const categories = React.useMemo(() => {
    const list: string[] = [];
    for (const p of rawProducts) {
      if (p.category?.name && !list.includes(p.category.name)) {
        list.push(p.category.name);
      }
    }
    return list;
  }, [rawProducts]);

  const warehouse = productsQuery.data?.warehouse ?? session?.cash_register.warehouse ?? null;
  const warehouseReady = productsQuery.data?.warehouse !== null &&
    productsQuery.data?.warehouse !== undefined &&
    (cashSessionsEnabled || productsQuery.data.warehouse.uuid === effectiveWarehouseUuid);
  const lowStockCount = rawProducts.filter((product) => product.is_low_stock).length;

  // Total wholesale packages/bultos
  const totalBultos = React.useMemo(() => {
    return lines.reduce((acc, line) => acc.plus(line.quantity || "0"), decimal(0)).toFixed(0);
  }, [lines]);

  const invoiceRequiresRuc =
    documentType === "01" &&
    (customer === null ||
      customer.identity_document_type !== "6" ||
      !/^\d{11}$/.test(customer.document_number));

  const receiptRequiresIdentity =
    documentType === "03" &&
    decimal(totals.total).greaterThan(700) &&
    !isIdentifiedCustomer(customer?.identity_document_type, customer?.document_number);

  const hasSaleToCheckout = lines.length > 0 && decimal(totals.total).isPositive();
  const customerIdentificationRequired = invoiceRequiresRuc || receiptRequiresIdentity;
  const canCheckout = hasSaleToCheckout && !customerIdentificationRequired && warehouseReady;

  React.useEffect(() => {
    if (!checkoutOpen && !customerOpen && !ticketOpen) {
      const timer = window.setTimeout(focusInput, 120);

      return () => window.clearTimeout(timer);
    }
  }, [checkoutOpen, customerOpen, ticketOpen, focusInput]);

  usePosHotkeys(
    {
      F2: () => {
        focusInput();
      },
      F4: () => {
        if (checkoutOpen) {
          return;
        }

        if (!hasSaleToCheckout) {
          toast.info("Agrega productos al carrito antes de cobrar.");
          return;
        }

        if (customerIdentificationRequired) {
          setCustomerOpen(true);
          toast.info(
            invoiceRequiresRuc
              ? "Selecciona un cliente con RUC válido para emitir la factura."
              : "Identifica al cliente antes de emitir esta boleta.",
          );
          return;
        }

        playSound("click");
        setCheckoutOpen(true);
      },
      F8: () => {
        setCustomerOpen(true);
      },
      ESCAPE: () => {
        if (checkoutOpen) {
          setCheckoutOpen(false);
          return;
        }

        if (customerOpen) {
          setCustomerOpen(false);
          return;
        }

        setSearch("");
      },
    },
    true,
  );

  const addToCart = (product: PosProduct, quantity = "1"): boolean => {
    if (!product.track_stock) {
      addProduct(product, quantity);
      playSound("add");
      return true;
    }

    const available = decimal(product.stock);
    const existing = lines.find((line) => line.product.uuid === product.uuid);
    const requested = decimal(existing?.quantity ?? "0").plus(quantity);

    if (!available.isPositive()) {
      toast.error(`${product.name} no tiene stock disponible.`);
      return false;
    }

    if (requested.greaterThan(available)) {
      toast.error(
        `Stock insuficiente de ${product.name}. Disponible: ${formatQuantity(product.stock)}.`,
      );
      return false;
    }

    addProduct(product, quantity);
    playSound("add");
    return true;
  };

  const scan = async (): Promise<void> => {
    const term = search.trim();

    if (term === "") {
      return;
    }

    try {
      if (!cashSessionsEnabled && effectiveWarehouseUuid === undefined) {
        toast.info("Selecciona el almacén antes de buscar o vender productos.");
        return;
      }

      const result = await fetchProducts(term, effectiveWarehouseUuid);
      const exact = result.products.find(
        (product) =>
          product.barcode === term || product.sku.toLowerCase() === term.toLowerCase(),
      );
      const target = exact ?? (result.products.length === 1 ? result.products[0] : null);

      if (!target) {
        toast.error("Producto no encontrado. Verifica el código o usa la búsqueda.");
        return;
      }

      if (addToCart(target, "1")) {
        setSearch("");
        focusInput();
      }
    } catch {
      toast.error("No se pudo consultar el catálogo. Intenta nuevamente.");
    }
  };

  const submitQuantity = (productUuid: string, value: string, max: string): void => {
    if (value.trim() === "") {
      setQuantity(productUuid, "1");
      return;
    }

    if (decimal(value).greaterThan(max) && decimal(max).isPositive()) {
      setQuantity(productUuid, decimal(max).toFixed(4));
      toast.info(`Cantidad ajustada al stock disponible: ${formatQuantity(max)}.`);
      return;
    }

    setQuantity(productUuid, value);
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) playSound("click");
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader
        title="Terminal de Ventas"
        description="Venta ágil por bultos y fardos, lector de barras y emisión directa de comprobantes."
        meta={
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/25 px-2.5 py-0.5 text-xs font-semibold text-primary">
              <span className="size-1.5 rounded-full bg-primary animate-pulse" />
              Terminal Lista para Vender
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Warehouse className="size-3 text-primary" />
              {warehouse?.name ?? (warehouseSelectionRequired ? "Selecciona un almacén" : "Almacén principal")}
            </span>
            {lowStockCount > 0 && (
              <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600 bg-amber-500/10">
                {lowStockCount} artículos con stock bajo
              </Badge>
            )}
            {session ? (
              <span className="font-mono text-xs tabular-nums text-muted-foreground hidden sm:inline">
                {session.summary?.sales_count ?? 0} ventas hoy / {formatMoney(session.summary?.total_sales ?? "0.00")}
              </span>
            ) : null}
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            {/* Audio toggle button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleSound}
              title={soundOn ? "Sonido activado" : "Sonido silenciado"}
              className="px-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {soundOn ? (
                <Volume2 className="size-4 text-primary" />
              ) : (
                <VolumeX className="size-4 text-muted-foreground" />
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (cashSessionsEnabled) void sessionQuery.refetch();
                else void warehousesQuery.refetch();
                if (cashSessionsEnabled || effectiveWarehouseUuid !== undefined) {
                  void productsQuery.refetch();
                }
              }}
              disabled={
                (cashSessionsEnabled && sessionQuery.isFetching) ||
                (!cashSessionsEnabled && warehousesQuery.isFetching) ||
                productsQuery.isFetching
              }
              className="cursor-pointer"
            >
              <RefreshCw
                className={cn(
                  "size-4 mr-1",
                  (
                    (cashSessionsEnabled && sessionQuery.isFetching) ||
                    (!cashSessionsEnabled && warehousesQuery.isFetching) ||
                    productsQuery.isFetching
                  ) && "animate-spin",
                )}
                strokeWidth={1.5}
              />
              Actualizar
            </Button>
          </div>
        }
      />

      {!cashSessionsEnabled ? (
        <section className="flex flex-col gap-2 rounded-xl border border-border bg-card px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold">Almacén de salida</p>
            <p className="text-[11px] text-muted-foreground">
              El stock se consulta y se descuenta del almacén seleccionado.
            </p>
          </div>
          {warehousesQuery.isLoading ? (
            <span className="text-xs text-muted-foreground">Cargando almacenes…</span>
          ) : warehousesQuery.isError ? (
            <span role="alert" className="text-xs text-destructive">
              No se pudieron cargar los almacenes. Actualiza el catálogo para reintentar.
            </span>
          ) : activeWarehouses.length === 0 ? (
            <span role="alert" className="text-xs text-destructive">
              No hay almacenes activos para vender.
            </span>
          ) : activeWarehouses.length === 1 ? (
            <span className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs font-medium">
              {activeWarehouses[0]?.name}
            </span>
          ) : (
            <Select
              value={effectiveWarehouseUuid ?? ""}
              onValueChange={(nextWarehouseUuid) => {
                if (lines.length > 0 && nextWarehouseUuid !== effectiveWarehouseUuid) {
                  toast.error("Vacía el carrito antes de cambiar de almacén.");
                  return;
                }

                setSelectedWarehouseUuid(nextWarehouseUuid);
                setSelectedCategory(null);
              }}
            >
              <SelectTrigger aria-label="Almacén de salida" className="w-full sm:w-72">
                <SelectValue placeholder="Selecciona un almacén" />
              </SelectTrigger>
              <SelectContent>
                {activeWarehouses.map((candidate) => (
                  <SelectItem key={candidate.uuid} value={candidate.uuid}>
                    {candidate.code} · {candidate.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </section>
      ) : null}

      {warehouseSelectionRequired ? (
        <p role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          Selecciona el almacén para consultar el stock y habilitar la venta.
        </p>
      ) : null}
      {!cashSessionsEnabled &&
      selectedWarehouseUuid !== null &&
      !selectedWarehouseIsActive &&
      lines.length > 0 ? (
        <p role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          El almacén asociado a este carrito ya no está activo. Vacía el carrito para elegir otro.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(380px,3.2fr)]">
          {/* Left: Product Catalog (Smart Bento Grid) */}
          <div className="flex min-h-[580px] flex-col rounded-2xl border border-border bg-card shadow-2xs overflow-hidden">
            {/* Search Bar + View Toggle */}
            <div className="border-b border-border p-3 flex items-center gap-2 bg-muted/10">
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  strokeWidth={1.8}
                />
                <Input
                  ref={inputRef}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void scan();
                    }
                  }}
                  placeholder="Escanea código de barras o escribe producto..."
                  className="h-10 pl-9 pr-16 font-mono text-xs rounded-xl bg-background"
                  autoComplete="off"
                />
                <div className="absolute top-1/2 right-2.5 flex -translate-y-1/2 items-center gap-1.5">
                  <Kbd className="h-5 bg-muted px-1.5 font-mono text-[9px] text-muted-foreground">F2</Kbd>
                  <Barcode className="size-4 text-muted-foreground" strokeWidth={1.5} />
                </div>
              </div>

              {/* View mode toggle (Bento vs Table) */}
              <div className="flex items-center rounded-xl border border-border bg-muted/40 p-1">
                <button
                  type="button"
                  onClick={() => setViewMode("bento")}
                  className={cn(
                    "flex size-7.5 items-center justify-center rounded-lg transition-all cursor-pointer",
                    viewMode === "bento"
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  title="Vista Mosaico Bento Táctil"
                >
                  <LayoutGrid className="size-4" strokeWidth={1.8} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={cn(
                    "flex size-7.5 items-center justify-center rounded-lg transition-all cursor-pointer",
                    viewMode === "table"
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  title="Vista Lista Compacta"
                >
                  <List className="size-4" strokeWidth={1.8} />
                </button>
              </div>
            </div>

            {/* Category Quick Pills */}
            <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-muted/20 px-3 py-2">
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className={cn(
                  "cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                  selectedCategory === null
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-background text-muted-foreground hover:bg-muted border border-border",
                )}
              >
                TODOS ({rawProducts.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                  className={cn(
                    "cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                    selectedCategory === cat
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-background text-muted-foreground hover:bg-muted border border-border",
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Products Canvas */}
            <div className="min-h-0 flex-1 overflow-y-auto p-3.5">
              {productsQuery.isLoading ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-36 rounded-xl animate-pulse bg-muted" />
                  ))}
                </div>
              ) : products.length === 0 ? (
                <div className="flex h-full min-h-56 flex-col items-center justify-center px-6 text-center">
                  <PackageSearch className="size-7 text-muted-foreground/60" strokeWidth={1.5} />
                  <p className="mt-2 text-xs font-semibold">Sin resultados</p>
                  <p className="mt-1 max-w-xs text-[11px] text-muted-foreground">
                    No hay productos que coincidan con el filtro actual.
                  </p>
                </div>
              ) : viewMode === "bento" ? (
                /* SMART BENTO TOUCH GRID - CLEAN & MINIMALIST */
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {products.map((product) => {
                    const badgeInfo = getCategoryBadge(product.category?.name, product.unit_code);
                    const Icon = badgeInfo.icon;
                    const stock = decimal(product.stock);
                    const disabled = product.track_stock && !stock.isPositive();

                    return (
                      <article
                        key={product.uuid}
                        className={cn(
                          "group relative flex flex-col justify-between rounded-2xl border p-4 transition-all duration-300 select-none",
                          "bg-card/80 hover:bg-card hover:border-primary/50 hover:shadow-brand-soft",
                          disabled
                            ? "opacity-40 border-border"
                            : "border-border/70",
                        )}
                      >
                        {/* Top: Category emblem & discrete stock dot */}
                        <button
                          type="button"
                          disabled={disabled}
                          aria-label={`Agregar ${product.name} al pedido`}
                          onClick={() => addToCart(product, "1")}
                          className="flex w-full flex-1 flex-col justify-start text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg disabled:cursor-not-allowed"
                        >
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground group-hover:text-primary transition-colors">
                            <Icon className="size-3.5 text-primary" strokeWidth={2} />
                            {badgeInfo.label}
                          </span>

                          {product.track_stock && (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 text-[11px] font-mono",
                                product.is_low_stock
                                  ? "text-amber-500 font-medium"
                                  : "text-muted-foreground/80",
                              )}
                            >
                              <span
                                className={cn(
                                  "size-1.5 rounded-full",
                                  product.is_low_stock
                                    ? "bg-amber-500 animate-pulse"
                                    : "bg-emerald-500",
                                )}
                              />
                              {formatQuantity(product.stock)} disp.
                            </span>
                          )}
                        </div>

                        {/* Middle: Product Name */}
                        <div className="my-2.5">
                          <h4 className="text-sm font-semibold tracking-tight text-foreground line-clamp-2 leading-snug group-hover:text-foreground">
                            {product.name}
                          </h4>
                        </div>
                        </button>

                        {/* Bottom: Crisp Price + Elegant Micro-Pill Wholesale Stepper */}
                        <div className="mt-auto flex items-center justify-between pt-1">
                          <div className="font-mono text-base font-bold tracking-tight text-foreground">
                            {formatMoney(product.sale_price, { scale: 2 })}
                          </div>

                          {/* Quick Wholesale Multiplier Chips */}
                          <div className="flex items-center gap-1 rounded-xl bg-muted/40 p-1 border border-border/50">
                            {["+1", "+5", "+10"].map((multiplier) => (
                              <button
                                key={multiplier}
                                type="button"
                                disabled={disabled}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addToCart(product, multiplier.replace("+", ""));
                                }}
                                className="cursor-pointer rounded-lg px-2 py-0.5 font-mono text-[11px] font-semibold text-muted-foreground transition-all hover:bg-primary hover:text-primary-foreground active:scale-95 disabled:opacity-40"
                                title={`Agregar ${multiplier}`}
                              >
                                {multiplier}
                              </button>
                            ))}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                /* COMPACT TABLE VIEW */
                <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                  {products.map((product) => {
                    const stock = decimal(product.stock);
                    const disabled = product.track_stock && !stock.isPositive();

                    return (
                      <div
                        key={product.uuid}
                        className={cn(
                          "grid w-full grid-cols-[minmax(0,1fr)_90px_110px_auto] items-center gap-2 p-2.5 text-left transition-colors cursor-pointer hover:bg-muted/40",
                          disabled && "opacity-50 cursor-not-allowed",
                        )}
                      >
                        <button
                          type="button"
                          disabled={disabled}
                          aria-label={`Agregar ${product.name} al pedido`}
                          onClick={() => addToCart(product, "1")}
                          className="col-span-3 grid grid-cols-[minmax(0,1fr)_90px_110px] items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed"
                        >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-foreground">
                            {product.name}
                          </p>
                          <p className="font-mono text-[9px] text-muted-foreground">
                            {product.sku} • {product.category?.name}
                          </p>
                        </div>
                        <div className="text-right font-mono text-[11px]">
                          <span>{formatQuantity(product.stock)}</span>
                          <span className="block text-[9px] text-muted-foreground">{product.unit_code}</span>
                        </div>
                        <div className="text-right font-mono text-xs font-bold">
                          {formatMoney(product.sale_price)}
                        </div>
                        </button>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={disabled}
                            aria-label={`Agregar ${product.name} al pedido`}
                            onClick={() => addToCart(product, "1")}
                            className="rounded-md border border-border bg-background p-1 hover:bg-primary hover:text-primary-foreground cursor-pointer"
                          >
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer Status */}
            <div className="flex items-center justify-between border-t border-border bg-muted/20 px-3 py-2 text-[10px] text-muted-foreground">
              <span className="font-mono tabular-nums font-semibold">{products.length} productos en pantalla</span>
              <span>F2 = Código de barras • F4 = Cobrar</span>
            </div>
          </div>

          {/* Right: Floating Cart / Order Summary */}
          <div className="flex min-h-[580px] flex-col rounded-2xl border border-border bg-card shadow-2xs overflow-hidden lg:sticky lg:top-3 lg:max-h-[calc(100svh-7rem)]">
            {/* Cart Header with Document Type Pills */}
            <div className="border-b border-border p-3.5 bg-muted/10 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
                    <ShoppingCart className="size-4 text-primary" strokeWidth={2} />
                    Pedido Actual
                  </h3>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    {totals.lines.length} {totals.lines.length === 1 ? "línea" : "líneas"} • {totalBultos} bultos totales
                  </p>
                </div>

                {/* Document Type Selector (Nota de Venta, Boleta, Factura) */}
                <div className="flex rounded-lg border border-border bg-background p-0.5">
                  {DOCUMENT_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setDocumentType(type);
                        playSound("click");
                      }}
                      className={cn(
                        "rounded-md px-2 py-1 font-mono text-[10px] font-semibold transition-all cursor-pointer",
                        documentType === type
                          ? "bg-primary text-primary-foreground shadow-2xs"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {DOCUMENT_TYPE_LABELS[type]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Customer Selector Bar */}
              <div className="flex items-center justify-between rounded-xl border border-border bg-background p-2">
                <button
                  type="button"
                  onClick={() => setCustomerOpen(true)}
                  className="flex items-center gap-2 text-left cursor-pointer flex-1 min-w-0"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <UserRound className="size-3.5" strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground">
                      {customer?.legal_name ?? "CLIENTES VARIOS"}
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {customer?.document_number ?? "00000000"}
                    </p>
                  </div>
                </button>
                {customer ? (
                  <button
                    type="button"
                    onClick={() => setCustomer(null)}
                    className="text-muted-foreground hover:text-red-500 text-xs px-1.5 cursor-pointer"
                    title="Quitar cliente"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                ) : (
                  <Kbd className="h-4 px-1 font-mono text-[9px] text-muted-foreground">F8</Kbd>
                )}
              </div>
            </div>

            {/* Cart Items List */}
            <div className="min-h-0 flex-1 overflow-y-auto p-2 space-y-1.5">
              {totals.lines.length === 0 ? (
                <div className="flex h-full min-h-48 flex-col items-center justify-center px-6 text-center">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/40 text-muted-foreground">
                    <ShoppingCart className="size-6" strokeWidth={1.5} />
                  </div>
                  <p className="mt-3 text-xs font-semibold">El carrito está vacío</p>
                  <p className="mt-1 max-w-[200px] text-[11px] text-muted-foreground leading-relaxed">
                    Toca las tarjetas del catálogo o escanea con el lector para agregar bultos.
                  </p>
                </div>
              ) : (
                totals.lines.map((line) => (
                  <div
                    key={line.product.uuid}
                    className="rounded-xl border border-border bg-card p-2.5 transition-all hover:border-primary/30"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 shrink-0">
                            {line.product.unit_code === "BE"
                              ? "FARDO"
                              : line.product.unit_code === "BX"
                              ? "CAJA"
                              : line.product.unit_code === "BG"
                              ? "BOLSA"
                              : "PQTE/UND"}
                          </span>
                          <p className="truncate text-xs font-semibold text-foreground">
                            {line.product.name}
                          </p>
                        </div>
                        <p className="font-mono text-[9.5px] text-muted-foreground mt-0.5">
                          {formatMoney(line.product.sale_price)} c/u • Subtotal: {line.total}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeProduct(line.product.uuid)}
                        className="text-muted-foreground hover:text-red-500 cursor-pointer p-0.5 shrink-0"
                        title="Quitar artículo"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>

                    {/* Stepper + Wholesale Quick Steps (+5, +10) */}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <div className="flex h-7 items-center rounded-lg border border-border bg-background">
                          <button
                            type="button"
                            onClick={() => decrement(line.product.uuid)}
                            className="flex size-7 items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <Minus className="size-3" strokeWidth={1.8} />
                          </button>
                          <Input
                            value={line.quantity}
                            onChange={(e) => setQuantity(line.product.uuid, e.target.value)}
                            onBlur={(e) =>
                              submitQuantity(
                                line.product.uuid,
                                e.target.value,
                                line.product.track_stock ? line.product.stock : "999999",
                              )
                            }
                            className="h-6 w-12 rounded-none border-0 text-center font-mono text-xs font-bold p-0 shadow-none focus-visible:ring-0"
                          />
                          <button
                            type="button"
                            onClick={() => increment(line.product.uuid)}
                            className="flex size-7 items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <Plus className="size-3" strokeWidth={1.8} />
                          </button>
                        </div>

                        {/* Wholesale quick steppers +5, +10 */}
                        <div className="flex items-center gap-1">
                          {["+5", "+10"].map((addQty) => (
                            <button
                              key={addQty}
                              type="button"
                              onClick={() => {
                                const next = decimal(line.quantity).plus(addQty.replace("+", "")).toFixed(0);
                                submitQuantity(
                                  line.product.uuid,
                                  next,
                                  line.product.track_stock ? line.product.stock : "999999",
                                );
                                playSound("add");
                              }}
                              className="rounded-lg border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] font-bold text-foreground hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer"
                              title={`Sumar ${addQty} al pedido`}
                            >
                              {addQty}
                            </button>
                          ))}
                        </div>
                      </div>

                      <span className="font-mono text-xs font-bold text-foreground">
                        {line.total}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Cart Footer: Total + Cobrar Button */}
            <div className="border-t border-border bg-muted/10 p-3.5 space-y-3">
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal sin IGV:</span>
                  <span className="font-mono">{formatMoney(totals.taxed)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>IGV (18% incluido):</span>
                  <span className="font-mono">{formatMoney(totals.igv)}</span>
                </div>
                <div className="flex items-baseline justify-between border-t border-border/60 pt-2 font-bold">
                  <span className="text-sm">Total a Cobrar:</span>
                  <span className="font-mono text-2xl text-primary font-bold">
                    {formatMoney(totals.total)}
                  </span>
                </div>
              </div>

              {invoiceRequiresRuc ? (
                <p className="text-[10px] text-red-600 dark:text-red-400 font-medium">
                  Factura requiere cliente con RUC de 11 dígitos.
                </p>
              ) : null}

              {receiptRequiresIdentity ? (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                  Boleta superior a S/ 700.00: identifica al cliente con DNI o RUC.
                </p>
              ) : null}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearCart}
                  disabled={lines.length === 0}
                  className="px-3 cursor-pointer"
                  title="Vaciar carrito"
                >
                  <Trash2 className="size-4" />
                </Button>

                {customerIdentificationRequired ? (
                  <Button
                    type="button"
                    size="lg"
                    className="flex-1 h-11 bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25 font-bold text-xs shadow-xs cursor-pointer flex items-center justify-between px-4 transition-all"
                    onClick={() => {
                      playSound("click");
                      setCustomerOpen(true);
                    }}
                  >
                    <span className="flex items-center gap-1.5">
                      <UserRound className="size-4" />
                      {invoiceRequiresRuc ? "Asignar RUC para Facturar" : "Identificar cliente"}
                    </span>
                    <Kbd className="h-5 bg-amber-500/20 px-1.5 font-mono text-[9px] text-amber-700 dark:text-amber-300">
                      F8
                    </Kbd>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="lg"
                    className="flex-1 h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-sm shadow-md cursor-pointer flex items-center justify-between px-4"
                    onClick={() => {
                      playSound("click");
                      setCheckoutOpen(true);
                    }}
                    disabled={!canCheckout}
                  >
                    <span className="flex items-center gap-1.5">
                      Cobrar ({DOCUMENT_TYPE_LABELS[documentType]})
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-bold">{formatMoney(totals.total)}</span>
                      <Kbd className="h-5 bg-white/20 px-1 font-mono text-[9px] text-primary-foreground">F4</Kbd>
                    </div>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

      {/* Checkout Modal with Fast-Tender & Change Calculator */}
      <CheckoutModal
        open={checkoutOpen}
        warehouseUuid={warehouse?.uuid ?? effectiveWarehouseUuid}
        onOpenChange={setCheckoutOpen}
        onCompleted={() => {
          clearCart();
        }}
      />

      {/* Customer Lookup/Create Modal */}
      <CustomerDialog open={customerOpen} onOpenChange={setCustomerOpen} />

      {/* Thermal Ticket Modal */}
      <ThermalTicketDialog
        open={ticketOpen}
        onOpenChange={(open) => {
          if (!open) {
            dismissLastTicket();
          }
        }}
        ticket={lastTicket}
      />
    </div>
  );
}
