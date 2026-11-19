import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Clock,
  Flame,
  Plus,
  Printer,
  Search,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Warehouse,
  Zap,
} from "lucide-react";
import * as React from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { ThermalTicketDialog } from "@/features/pos/ThermalTicketDialog";
import {
  DOCUMENT_TYPE_LABELS,
  fetchSales,
  fetchSaleTicket,
} from "@/features/pos/api";
import { fetchDashboardSummary } from "@/features/overview/api";
import type { DashboardSummary } from "@/types/overview";
import { formatMoney } from "@/lib/currency";
import { formatDateTime } from "@/lib/datetime";
import { decimal } from "@/lib/decimal";
import { primaryRoleLabel } from "@/lib/identity";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import type { Sale, SaleTicket } from "@/types/pos";

function getGreetingForHour(hour: number): string {
  if (hour >= 5 && hour < 12) return "Buenos días";
  if (hour >= 12 && hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

const INITIAL_GREETING = getGreetingForHour(new Date().getHours());

export function OverviewPage() {
  const navigate = useNavigate();
  const companyUuid = useAuthStore((state) => state.company?.uuid ?? null);
  const [searchTx, setSearchTx] = React.useState("");
  const [docFilter, setDocFilter] = React.useState<string>("all");
  const [selectedTicket, setSelectedTicket] = React.useState<SaleTicket | null>(null);
  const [ticketOpen, setTicketOpen] = React.useState(false);

  const summaryQuery = useQuery({
    queryKey: ["dashboard", "summary", companyUuid],
    queryFn: fetchDashboardSummary,
    enabled: Boolean(companyUuid),
    staleTime: 30_000,
  });

  const summary = summaryQuery.data;
  const isSummaryLoading = !companyUuid || summaryQuery.isLoading;
  const recentSalesQuery = useQuery({
    queryKey: ["pos", "recent-sales", companyUuid],
    queryFn: () => fetchSales({ per_page: 25 }),
    enabled: summary?.permissions.sales === true,
    staleTime: 15_000,
  });

  const queriedSales = recentSalesQuery.data?.rows;
  const allSales = React.useMemo(() => queriedSales ?? [], [queriedSales]);
  const canViewSales = summary?.permissions.sales ?? false;
  const canViewProducts = summary?.permissions.products ?? false;
  const salesCount = summary?.sales?.count ?? 0;
  const totalSales = summary?.sales?.total ?? "0.00";
  const avgTicket = summary?.sales?.average_ticket ?? "0.00";
  const formatDashboardMoney = (value: string): string => formatMoney(value, { currency: summary?.currency ?? "PEN" });
  const criticalStockItems = summary?.stock?.low_stock_products ?? [];
  const lowStockCount = summary?.stock?.low_stock_count ?? 0;
  const trackedStockCount = summary?.stock?.tracked_products_count ?? 0;
  const topMovers = summary?.top_products ?? [];
  const hourlySlots = summary?.hourly_sales ?? [];
  const hourlyMaxCount = Math.max(1, ...hourlySlots.map((slot) => slot.count));
  const peakSlot = hourlySlots.reduce<DashboardSummary["hourly_sales"][number] | null>(
    (peak, slot) => slot.count > 0 && (peak === null || slot.count > peak.count) ? slot : peak,
    null,
  );
  const hourlyPoints = hourlySlots.map((slot, index) => ({
    x: hourlySlots.length <= 1 ? 300 : (index / (hourlySlots.length - 1)) * 600,
    y: 140 - (slot.count / hourlyMaxCount) * 105,
  }));
  const firstHourlyPoint = hourlyPoints.at(0);
  const lastHourlyPoint = hourlyPoints.at(-1);
  const hourlyPath = hourlyPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const hourlyAreaPath = firstHourlyPoint && lastHourlyPoint
    ? `${hourlyPath} L ${lastHourlyPoint.x} 160 L ${firstHourlyPoint.x} 160 Z`
    : "";

  // Filtered Transactions
  const filteredSales = React.useMemo(() => {
    return allSales.filter((sale) => {
      const matchDoc = docFilter === "all" || sale.document_type === docFilter;
      const term = searchTx.toLowerCase().trim();
      const matchSearch =
        term === "" ||
        sale.number.toLowerCase().includes(term) ||
        sale.customer?.legal_name?.toLowerCase().includes(term) ||
        String(sale.correlative).includes(term);
      return matchDoc && matchSearch;
    });
  }, [allSales, docFilter, searchTx]);

  const handleOpenTicket = async (saleUuid: string) => {
    try {
      const ticket = await fetchSaleTicket(saleUuid);
      setSelectedTicket(ticket);
      setTicketOpen(true);
    } catch {
      // handled
    }
  };

  const handleShareWhatsApp = (sale: Sale) => {
    const docLabel = DOCUMENT_TYPE_LABELS[sale.document_type] ?? "Comprobante";
    const companyName = company?.branding.display_name ?? company?.trade_name ?? "";
    const text = `*${companyName}*\nComprobante: *${sale.number}* (${docLabel})\nCliente: ${sale.customer?.legal_name ?? "Cliente"}\nFecha: ${sale.issue_date ? formatDateTime(sale.issue_date) : "Hoy"}\n\n*TOTAL: ${formatMoney(sale.totals.total)}*\n\n¡Gracias por su compra en ${companyName}!`;
    const phone = sale.customer?.phone ? sale.customer.phone.replace(/\D/g, "") : "";
    const url = phone
      ? `https://api.whatsapp.com/send?phone=51${phone}&text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const user = useAuthStore((state) => state.user);
  const company = useAuthStore((state) => state.company);
  const roles = useAuthStore((state) => state.roles);

  const greeting = INITIAL_GREETING;

  const roleText = primaryRoleLabel(roles);
  const displayName = user?.name.trim().split(/\s+/)[0] || roleText || "Vendedor";

  return (
    <div className="space-y-6 pb-8">
      {/* 1. Header: Command Strip (Cockpit Style) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <span>{greeting}, {displayName}</span>
              <span className="text-lg">👋</span>
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/25 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
              <span className="size-1.5 rounded-full bg-primary animate-pulse" />
              Terminal Lista para Vender
            </span>
            <span className="rounded-md bg-muted/60 border border-border/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {roleText}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
            <Warehouse className="size-3 text-primary" />
            <span>
              {isSummaryLoading
                ? "Consultando almacén e indicadores…"
                : summaryQuery.isError
                  ? "No se pudieron cargar los indicadores del negocio."
                  : `Almacén: ${summary?.warehouse?.name ?? "Sin almacén activo"} • ${summary?.timezone ?? ""}`}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => navigate("/pos")}
            className="h-10 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs rounded-xl shadow-brand-glow cursor-pointer px-4 flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-95"
          >
            <Plus className="size-4" strokeWidth={2.5} />
            <span>Nueva Venta</span>
            <Kbd className="h-4 bg-white/20 px-1 font-mono text-[9px] text-primary-foreground">F4</Kbd>
          </Button>
        </div>
      </div>

      {/* 2. Main Stage: Asymmetrical Bento Grid (Hero Pulse 65% + Stock Radar 35%) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Main Stage (2 Cols): Midday-Inspired Live Pulse with Neon Wave */}
        <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card/95 to-muted/20 p-6 shadow-xs lg:col-span-2 space-y-5">
          {/* Ambient Lighting Bloom */}
          <div className="pointer-events-none absolute -right-16 -top-16 size-72 rounded-full bg-primary/15 blur-3xl" />
          <div className="pointer-events-none absolute -left-16 -bottom-16 size-56 rounded-full bg-sky-500/10 blur-3xl" />

          {/* Top Bar inside Hero */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <Activity className="size-5" strokeWidth={2} />
              </div>
              <div>
                <span className="text-xs font-bold text-foreground uppercase tracking-wider block">
                  Pulso Comercial del Día
                </span>
                <p className="text-[11px] text-muted-foreground">
                  Importe y cantidad de ventas registradas hoy
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 border border-border/60 px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                <span>{isSummaryLoading ? "Cargando" : summaryQuery.isError ? "Sin conexión" : canViewSales ? "Datos del día" : "Sin permiso de ventas"}</span>
              </span>
              <span className="rounded-xl border border-border/60 bg-background/60 px-2.5 py-0.5 font-mono text-xs font-semibold text-foreground backdrop-blur-xs">
                {isSummaryLoading || summaryQuery.isError || !canViewSales ? "—" : `${salesCount} ${salesCount === 1 ? "venta" : "ventas"}`}
              </span>
            </div>
          </div>

          {/* Big Hero Number & Embedded Micro-Pills */}
          <div className="relative z-10 flex flex-wrap items-baseline justify-between gap-4 pt-1">
            <div>
              <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider block">
                Total de ventas hoy
              </span>
              <div className="font-mono text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground mt-0.5">
                {isSummaryLoading ? "—" : summaryQuery.isError ? "No disponible" : !canViewSales ? "Sin acceso" : formatDashboardMoney(totalSales)}
                <span className="ml-2 font-mono text-base font-normal text-muted-foreground">
                  {summary?.currency ?? "PEN"}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
              <div className="rounded-2xl border border-border/60 bg-background/60 px-3.5 py-2 backdrop-blur-xs shadow-2xs">
                <span className="text-[10px] text-muted-foreground uppercase block font-sans">
                  Ticket Promedio
                </span>
                <span className="font-bold text-foreground">
                  {isSummaryLoading ? "—" : summaryQuery.isError ? "—" : !canViewSales ? "Sin acceso" : formatDashboardMoney(avgTicket)}
                </span>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/60 px-3.5 py-2 backdrop-blur-xs shadow-2xs">
                <span className="text-[10px] text-muted-foreground uppercase block font-sans">
                  Catálogo Activo
                </span>
                <span className="font-bold text-primary">
                  {isSummaryLoading ? "—" : summaryQuery.isError ? "—" : !canViewProducts ? "Sin acceso" : `${summary?.active_products_count ?? 0} líneas`}
                </span>
              </div>
            </div>
          </div>

          <div className="relative mt-4 h-44 w-full rounded-2xl border border-border/40 bg-background/30 p-3">
            {isSummaryLoading ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Cargando ventas del día…</div>
            ) : summaryQuery.isError ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Gráfico no disponible.</div>
            ) : !canViewSales ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No tienes permiso para consultar ventas.</div>
            ) : salesCount === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Aún no hay ventas registradas hoy.</div>
            ) : (
              <>
                <svg className="h-[calc(100%-1.5rem)] w-full" viewBox="0 0 600 160" preserveAspectRatio="none" role="img" aria-label="Ventas por franja horaria">
                  <defs>
                    <linearGradient id="dashboardSalesArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.28" />
                      <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  {[35, 80, 125].map((y) => <line key={y} x1="0" y1={y} x2="600" y2={y} stroke="currentColor" strokeOpacity="0.08" />)}
                  <path d={hourlyAreaPath} fill="url(#dashboardSalesArea)" />
                  <path d={hourlyPath} fill="none" stroke="var(--brand)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  {hourlyPoints.map((point, index) => {
                    const slot = hourlySlots[index];
                    return slot && slot.count > 0
                      ? <circle key={slot.range} cx={point.x} cy={point.y} r="4" fill="var(--brand)" />
                      : null;
                  })}
                </svg>
                <div className="flex justify-between gap-1 overflow-hidden font-mono text-[9px] text-muted-foreground">
                  {hourlySlots.map((slot) => <span key={slot.range} className="truncate">{slot.range.split(" - ")[0]}</span>)}
                  <span>24:00</span>
                </div>
              </>
            )}
          </div>
        </div>
        {/* Companion Column (1 Col): Radar de Abastecimiento (OpenStatus Style) */}
        <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-4">
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    "flex size-9 items-center justify-center rounded-2xl",
                    lowStockCount > 0
                      ? "bg-amber-500/15 text-amber-500"
                      : summaryQuery.isError
                        ? "bg-red-500/15 text-red-500"
                        : isSummaryLoading || !canViewProducts
                          ? "bg-muted text-muted-foreground"
                          : "bg-emerald-500/15 text-emerald-500",
                  )}
                >
                  {lowStockCount > 0 ? (
                    <ShieldAlert className="size-5" strokeWidth={2} />
                  ) : summaryQuery.isError ? (
                    <ShieldAlert className="size-5" strokeWidth={2} />
                  ) : isSummaryLoading || !canViewProducts ? (
                    <Boxes className="size-5" strokeWidth={2} />
                  ) : (
                    <CheckCircle2 className="size-5" strokeWidth={2} />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Radar de Almacén
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Semáforo de reposición de mercadería
                  </p>
                </div>
              </div>

              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[10px] font-bold",
                  lowStockCount > 0
                    ? "bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400"
                    : summaryQuery.isError
                      ? "bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400"
                      : isSummaryLoading || !canViewProducts
                        ? "bg-muted text-muted-foreground"
                        : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
                )}
              >
                {isSummaryLoading ? "Cargando" : summaryQuery.isError ? "No disponible" : !canViewProducts ? "Sin permiso" : lowStockCount > 0 ? `${lowStockCount} alertas` : "Sin alertas"}
              </span>
            </div>

            {isSummaryLoading ? (
              <p className="py-8 text-center text-xs text-muted-foreground">Consultando existencias…</p>
            ) : summaryQuery.isError ? (
              <p className="py-8 text-center text-xs text-red-600 dark:text-red-400">No se pudo consultar el inventario.</p>
            ) : !canViewProducts ? (
              <p className="py-8 text-center text-xs text-muted-foreground">No tienes permiso para consultar el inventario.</p>
            ) : !summary?.warehouse ? (
              <p className="py-8 text-center text-xs text-muted-foreground">No hay un almacén activo para mostrar existencias.</p>
            ) : trackedStockCount === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">No hay productos activos con control de stock.</p>
            ) : lowStockCount === 0 ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 className="mx-auto size-6 text-emerald-500" />
                <p className="text-xs font-semibold text-foreground">Sin alertas de reposición</p>
                <p className="text-[11px] text-muted-foreground">{trackedStockCount} productos con control de stock revisados.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {criticalStockItems.map((item) => {
                  const stockNum = decimal(item.stock).toNumber();
                  const minNum = decimal(item.min_stock).toNumber();
                  const isRed = stockNum <= minNum;

                  return (
                    <div
                      key={item.uuid}
                      className={cn(
                        "rounded-2xl border p-3.5 space-y-2 transition-all",
                        isRed
                          ? "border-red-500/30 bg-red-500/5 dark:bg-red-950/20"
                          : "border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/20",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-foreground block truncate">{item.name}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">SKU: {item.sku}</span>
                        </div>
                        <span className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0",
                          isRed ? "bg-red-500/15 text-red-600 dark:text-red-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                        )}>
                          {isRed ? "Crítico" : "Por agotar"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs font-mono pt-0.5">
                        <span className="text-muted-foreground text-[11px]">Disponible:</span>
                        <span className="font-bold text-foreground">{stockNum} / Mín: {minNum} {item.unit_code}</span>
                      </div>

                      <div className="h-1.5 w-full rounded-full bg-muted/80 overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all duration-500", isRed ? "bg-red-500" : "bg-amber-500")}
                          style={{ width: `${Math.min(100, Math.max(12, (stockNum / (minNum || 1)) * 100))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {lowStockCount > criticalStockItems.length ? (
                  <p className="text-center text-[11px] text-muted-foreground">Y {lowStockCount - criticalStockItems.length} productos más requieren revisión.</p>
                ) : null}
              </div>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/inventario")}
            className="w-full h-9 rounded-xl text-xs font-semibold cursor-pointer gap-2 border-border/80 hover:border-primary hover:text-primary transition-all"
          >
            <Boxes className="size-4" />
            <span>Consultar Kardex & Stock</span>
          </Button>
        </div>
      </div>

      {/* 3. Middle Strip: Top Movers vs Compact Hourly Heatmap */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Box Left: Podio de Mayor Rotación (Dub.co Style) */}
        <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3.5">
            <div className="flex items-center gap-2">
              <Flame className="size-5 text-primary" />
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Productos más vendidos hoy
                </h3>
                <p className="text-xs text-muted-foreground">
                  Ordenados por unidades registradas en ventas del día
                </p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/pos")}
              className="h-8 text-xs text-primary hover:text-primary/90 cursor-pointer gap-1"
            >
              <span>Vender</span>
              <ArrowRight className="size-3.5" />
            </Button>
          </div>

          <div className="space-y-3 pt-1">
            {isSummaryLoading ? (
              <p className="py-8 text-center text-xs text-muted-foreground">Consultando ventas del día…</p>
            ) : summaryQuery.isError ? (
              <p className="py-8 text-center text-xs text-red-600 dark:text-red-400">No se pudieron consultar los productos vendidos.</p>
            ) : !canViewSales || !canViewProducts ? (
              <p className="py-8 text-center text-xs text-muted-foreground">Falta permiso para consultar ventas y productos.</p>
            ) : topMovers.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">Aún no hay productos vendidos hoy.</p>
            ) : topMovers.map((mover, index) => (
              <div
                key={mover.uuid}
                className="group rounded-2xl border border-border/60 bg-muted/20 p-3.5 transition-all hover:bg-muted/40 hover:border-border"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-background font-mono text-xs font-bold text-primary border border-border/60 shadow-2xs">
                      #{index + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-foreground line-clamp-1">{mover.name}</div>
                      <p className="text-[11px] text-muted-foreground">{mover.quantity_sold} {mover.unit_code} vendidos hoy</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-right font-mono">
                    <div>
                      <span className="text-[9px] text-muted-foreground uppercase block font-sans">Stock actual</span>
                      <span className="text-xs font-bold text-foreground">
                        {mover.track_stock ? `${mover.stock ?? "0"} ${mover.unit_code}` : "No controlado"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-muted-foreground uppercase block font-sans">Vendido</span>
                      <span className="text-xs font-bold text-primary">{formatDashboardMoney(mover.total_sold)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-2.5 flex items-center gap-3">
                  <div className="h-1.5 flex-1 rounded-full bg-muted/80 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70" style={{ width: `${mover.share}%` }} />
                  </div>
                  <span className="font-mono text-[10px] font-bold text-muted-foreground shrink-0">{mover.share}% del importe</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Box Right: Ritmo de Afluencia & Horas Pico (Compact Heatmap) */}
        <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3.5">
            <div className="flex items-center gap-2">
              <Clock className="size-5 text-sky-500" />
              <div>
                <h3 className="text-sm font-bold text-foreground">
                Ventas por franja horaria
                </h3>
                <p className="text-xs text-muted-foreground">
                Recuento e importe de las ventas de hoy
                </p>
              </div>
            </div>

            {isSummaryLoading ? (
              <span className="text-xs text-muted-foreground">Cargando franjas…</span>
            ) : summaryQuery.isError ? (
              <span className="text-xs text-muted-foreground">Datos no disponibles</span>
            ) : !canViewSales ? (
              <span className="text-xs text-muted-foreground">Sin permiso de ventas</span>
            ) : peakSlot ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 px-2.5 py-0.5 text-xs font-bold text-sky-600 dark:text-sky-400">
                <Zap className="size-3.5" />
                <span>Mayor actividad: {peakSlot.range}</span>
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Sin ventas en las franjas mostradas</span>
            )}
          </div>

          <div className="space-y-3 pt-1">
            {hourlySlots.map((slot) => {
              const isPeak = peakSlot?.range === slot.range;
              const percent = slot.count > 0 ? Math.round((slot.count / hourlyMaxCount) * 100) : 0;

              return (
                <div
                  key={slot.range}
                  className={cn(
                    "rounded-2xl border p-3 transition-all flex items-center justify-between gap-3",
                    isPeak
                      ? "border-primary/50 bg-primary/5 shadow-2xs"
                      : "border-border/60 bg-muted/20 hover:bg-muted/40",
                  )}
                >
                  <div className="min-w-0 w-36 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-foreground">
                        {slot.range}
                      </span>
                      {isPeak && (
                        <span className="rounded bg-primary/15 text-primary text-[9px] font-bold px-1 py-0.2">
                          PICO
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground block truncate">{formatDashboardMoney(slot.total)}</span>
                  </div>

                  {/* Horizontal Bar */}
                  <div className="h-2 flex-1 rounded-full bg-muted/80 overflow-hidden mx-2">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        isPeak ? "bg-primary" : "bg-muted-foreground/35",
                      )}
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  <div className="text-right font-mono text-xs font-bold text-foreground shrink-0 w-16">
                    {slot.count} <span className="text-[10px] font-normal text-muted-foreground">ventas</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. Bottom Stage: Activity Stream (Linear / Dub.co Style Live Feed) */}
      <div className="rounded-3xl border border-border/80 bg-card shadow-xs overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 p-5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Sparkles className="size-5" strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Ventas recientes
              </h3>
              <p className="text-xs text-muted-foreground">
                Últimos comprobantes registrados, con acceso a WhatsApp e impresión de ticket
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter buttons */}
            <div className="flex rounded-xl border border-border/80 bg-muted/40 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setDocFilter("all")}
                className={cn(
                  "cursor-pointer rounded-lg px-3 py-1 transition-all",
                  docFilter === "all"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Todas
              </button>
              <button
                type="button"
                onClick={() => setDocFilter("00")}
                className={cn(
                  "cursor-pointer rounded-lg px-3 py-1 transition-all",
                  docFilter === "00"
                    ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Notas de Venta
              </button>
              <button
                type="button"
                onClick={() => setDocFilter("03")}
                className={cn(
                  "cursor-pointer rounded-lg px-3 py-1 transition-all",
                  docFilter === "03"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Boletas
              </button>
              <button
                type="button"
                onClick={() => setDocFilter("01")}
                className={cn(
                  "cursor-pointer rounded-lg px-3 py-1 transition-all",
                  docFilter === "01"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Facturas
              </button>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTx}
                onChange={(e) => setSearchTx(e.target.value)}
                placeholder="Buscar cliente, número..."
                className="h-8 pl-8 text-xs w-48 font-mono rounded-xl bg-background"
              />
            </div>
          </div>
        </div>

        {/* Stream of Transactions */}
        <div className="divide-y divide-border/40">
          {!canViewSales ? (
            <div className="py-12 text-center text-xs text-muted-foreground">No tienes permiso para consultar las ventas recientes.</div>
          ) : recentSalesQuery.isLoading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">Cargando ventas recientes…</div>
          ) : recentSalesQuery.isError ? (
            <div className="py-12 text-center text-xs text-red-600 dark:text-red-400">No se pudieron consultar las ventas recientes.</div>
          ) : filteredSales.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No hay ventas recientes que coincidan con la búsqueda.
            </div>
          ) : (
            filteredSales.map((sale) => {
              const initials = (sale.customer?.legal_name ?? "CV")
                .split(" ")
                .slice(0, 2)
                .map((n) => n[0])
                .join("")
                .toUpperCase();

              return (
                <div
                  key={sale.uuid}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    {/* Monogram avatar with gradient */}
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 font-mono text-xs font-bold text-primary border border-primary/20 shadow-2xs">
                      {initials}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-foreground">
                          {sale.number}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            sale.document_type === "00"
                              ? "bg-primary/10 text-primary"
                              : sale.document_type === "03"
                              ? "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                              : "bg-purple-500/10 text-purple-600 dark:text-purple-400",
                          )}
                        >
                          {DOCUMENT_TYPE_LABELS[sale.document_type]}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {sale.customer?.legal_name ?? "Clientes Varios"}
                        {sale.customer?.document_number && sale.customer.document_number !== "00000000" && (
                          <span className="ml-1.5 font-mono text-[10px] opacity-70">
                            ({sale.customer.document_number})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-mono text-sm font-bold text-foreground">
                        {formatMoney(sale.totals.total)}
                      </div>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {sale.issue_date ? formatDateTime(sale.issue_date) : "Hoy"}
                      </span>
                    </div>

                    {/* WhatsApp Quick Share Button */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleShareWhatsApp(sale)}
                      className="h-8 rounded-xl px-2.5 text-xs cursor-pointer text-emerald-600 border-emerald-600/30 hover:bg-emerald-500/10 transition-all gap-1"
                      title="Enviar comprobante por WhatsApp"
                    >
                      <Smartphone className="size-3.5" />
                      <span className="hidden sm:inline">WhatsApp</span>
                    </Button>

                    {/* Thermal Ticket Modal Button */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenTicket(sale.uuid)}
                      className="h-8 rounded-xl px-2.5 text-xs cursor-pointer hover:border-primary hover:text-primary transition-all gap-1"
                      title="Ver e imprimir Ticket Térmico"
                    >
                      <Printer className="size-3.5" />
                      <span>Ticket</span>
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Thermal Ticket Modal */}
      <ThermalTicketDialog
        open={ticketOpen}
        onOpenChange={setTicketOpen}
        ticket={selectedTicket}
      />
    </div>
  );
}
