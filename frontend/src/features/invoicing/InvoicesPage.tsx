import * as React from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileCheck2,
  FileText,
  Printer,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { ApiClientError } from "@/api/client";
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
import { ThermalTicketDialog } from "@/features/pos/ThermalTicketDialog";
import {
  DOCUMENT_TYPE_LABELS,
  fetchSaleTicket,
  fetchSales,
  voidSale,
  SUNAT_STATUS_LABELS,
} from "@/features/pos/api";
import { formatMoney } from "@/lib/currency";
import { formatDateTime } from "@/lib/datetime";
import { decimal } from "@/lib/decimal";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import type { DocumentType, Sale, SaleTicket, SunatStatus } from "@/types/pos";

const ALL = "all";

const SUNAT_BADGES: Record<SunatStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  INTERNAL: {
    label: "Interno (Nota)",
    className: "bg-primary/10 text-primary border border-primary/20",
    icon: FileCheck2,
  },
  PENDING: {
    label: "Pendiente Envío",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
    icon: Clock,
  },
  ACCEPTED: {
    label: "Aceptado SUNAT",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
    icon: CheckCircle2,
  },
  OBSERVED: {
    label: "Observado",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
    icon: Clock,
  },
  REJECTED: {
    label: "Rechazado",
    className: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
    icon: XCircle,
  },
  ANNULLED: {
    label: "Anulado",
    className: "bg-muted text-muted-foreground border border-border",
    icon: Ban,
  },
};

export function InvoicesPage() {
  const [search, setSearch] = React.useState("");
  const deferredSearch = React.useDeferredValue(search);
  const [documentType, setDocumentType] = React.useState<string>(ALL);
  const [sunatStatus, setSunatStatus] = React.useState<string>(ALL);
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [ticket, setTicket] = React.useState<SaleTicket | null>(null);
  const [ticketOpen, setTicketOpen] = React.useState(false);
  const sunat = useAuthStore((state) => state.company?.sunat ?? null);
  const transmissionLabel = !sunat
    ? "Configuración no disponible"
    : sunat.mode === "simulate"
      ? "Simulación local"
      : sunat.mode === "auto"
        ? "Automático"
        : sunat.environment === "production"
          ? "Producción SUNAT"
          : "Pruebas SUNAT";
  const transmissionDescription = !sunat
    ? "No se pudo consultar el modo de emisión."
    : sunat.mode === "simulate"
      ? "Los comprobantes se generan localmente y no se envían a SUNAT."
      : sunat.mode === "auto"
        ? "Se intenta transmitir y se usa simulación local si el servicio no responde."
        : sunat.environment === "production"
          ? "Modo de transmisión configurado para el entorno de producción."
          : "Modo de transmisión configurado para el entorno de pruebas.";

  const salesQuery = useQuery({
    queryKey: [
      "pos",
      "sales",
      deferredSearch,
      documentType,
      sunatStatus,
      dateFrom,
      dateTo,
      page,
    ],
    queryFn: () =>
      fetchSales({
        search: deferredSearch || undefined,
        document_type: documentType === ALL ? undefined : (documentType as DocumentType),
        sunat_status: sunatStatus === ALL ? undefined : (sunatStatus as SunatStatus),
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        per_page: 20,
        page,
      }),
    placeholderData: keepPreviousData,
  });

  const ticketMutation = useMutation({
    mutationFn: fetchSaleTicket,
    onSuccess: (loaded) => {
      setTicket(loaded);
      setTicketOpen(true);
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof ApiClientError ? error.message : "No se pudo cargar el ticket.",
      );
    },
  });

  const queryClient = useQueryClient();

  const voidMutation = useMutation({
    mutationFn: (uuid: string) => voidSale(uuid, "Anulación solicitada desde panel de comprobantes"),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["pos", "sales"] });
      void queryClient.invalidateQueries({ queryKey: ["pos", "recent-sales"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "summary"] });
      void queryClient.invalidateQueries({ queryKey: ["inventory", "kardex"] });
      void queryClient.invalidateQueries({ queryKey: ["inventory", "summary"] });
      void queryClient.invalidateQueries({ queryKey: ["pos", "products"] });
      toast.success(`Comprobante ${result.sale.number} anulado.`);
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof ApiClientError ? error.message : "No se pudo anular el comprobante.",
      );
    },
  });

  const queriedRows = salesQuery.data?.rows;
  const rows = React.useMemo(() => queriedRows ?? [], [queriedRows]);
  const pagination = salesQuery.data?.pagination;

  // Calculate quick stats from current rows
  const totalBilled = React.useMemo(() => {
    return rows.reduce((acc, row) => acc.plus(row.totals.total || "0"), decimal(0)).toFixed(2);
  }, [rows]);

  const resetFilters = (): void => {
    setSearch("");
    setDocumentType(ALL);
    setSunatStatus(ALL);
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <PageHeader
        section="Gestión Fiscal"
        title="Facturación & Comprobantes"
        description="Emisión electrónica UBL 2.1, estado de transmisión SUNAT y gestión de notas de crédito."
        meta={
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs font-semibold text-primary">
              <FileText className="size-3" />
              UBL 2.1 SUNAT
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              {pagination?.total ?? 0} comprobantes registrados
            </span>
          </>
        }
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void salesQuery.refetch()}
            disabled={salesQuery.isFetching}
            className="rounded-xl cursor-pointer font-medium text-xs hover:border-primary"
          >
            <RefreshCw
              className={cn("size-3.5 mr-1.5", salesQuery.isFetching && "animate-spin")}
              strokeWidth={1.8}
            />
            Actualizar
          </Button>
        }
      />

      {/* KPI Highlight Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border/70 bg-card p-4.5 shadow-xs space-y-1">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
            Facturado en Esta Página
          </span>
          <div className="font-mono text-2xl font-bold tracking-tight text-foreground">
            {formatMoney(totalBilled)}
          </div>
          <p className="text-[11px] text-muted-foreground">Suma de las ventas listadas</p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-4.5 shadow-xs space-y-1">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
            Total en Histórico
          </span>
          <div className="font-mono text-2xl font-bold tracking-tight text-primary">
            {pagination?.total ?? 0}
          </div>
          <p className="text-[11px] text-muted-foreground">Comprobantes acumulados en base de datos</p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-4.5 shadow-xs space-y-1">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
            Modo de Transmisión
          </span>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn("size-2 rounded-full", !sunat ? "bg-muted-foreground" : sunat.mode === "simulate" ? "bg-amber-500" : sunat.mode === "live" && sunat.environment === "production" ? "bg-emerald-500" : "bg-sky-500")} />
            <span className="font-mono text-base font-semibold text-foreground">{transmissionLabel}</span>
          </div>
          <p className="text-[11px] text-muted-foreground">{transmissionDescription}</p>
        </div>
      </div>

      {/* Filter Dock */}
      <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-xs space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Search Input */}
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por serie, número, DNI o cliente..."
              className="h-9 pl-8 text-xs rounded-xl bg-background font-mono"
            />
          </div>

          {/* Document Type Select */}
          <Select
            value={documentType}
            onValueChange={(val) => {
              setDocumentType(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 text-xs rounded-xl bg-background">
              <SelectValue placeholder="Tipo de comprobante" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los comprobantes</SelectItem>
              {(Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]).map((type) => (
                <SelectItem key={type} value={type}>
                  {DOCUMENT_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* SUNAT Status Select */}
          <Select
            value={sunatStatus}
            onValueChange={(val) => {
              setSunatStatus(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 text-xs rounded-xl bg-background">
              <SelectValue placeholder="Estado SUNAT" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los estados</SelectItem>
              {(Object.keys(SUNAT_STATUS_LABELS) as SunatStatus[]).map((status) => (
                <SelectItem key={status} value={status}>
                  {SUNAT_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date from / to */}
          <div className="flex items-center gap-1.5">
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

        {(search || documentType !== ALL || sunatStatus !== ALL || dateFrom || dateTo) && (
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

      {/* Modern Invoices List */}
      <div className="rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/50 p-4 bg-muted/10">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Comprobantes Emitidos
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {pagination
              ? `${String(pagination.from ?? 0)}-${String(pagination.to ?? 0)} de ${String(pagination.total)}`
              : "--"}
          </span>
        </div>

        <div className="divide-y divide-border/40">
          {salesQuery.isLoading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              <RefreshCw className="size-5 animate-spin mx-auto mb-2 text-primary" />
              Cargando comprobantes...
            </div>
          ) : salesQuery.isError ? (
            <div className="p-8 text-center text-xs text-red-500">
              Error al consultar los comprobantes.
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground text-sm">No se encontraron comprobantes</p>
              <p>Emite una venta desde el punto de venta para visualizarla aquí.</p>
            </div>
          ) : (
            rows.map((sale: Sale) => {
              const statusCfg = SUNAT_BADGES[sale.sunat.status] ?? SUNAT_BADGES.INTERNAL;
              const StatusIcon = statusCfg.icon;

              return (
                <div
                  key={sale.uuid}
                  className="flex flex-wrap items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/20"
                >
                  {/* Left: Document info & customer */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 font-mono text-xs font-bold text-primary">
                      {sale.document_type === "00" ? "NV" : sale.document_type === "03" ? "B0" : "F0"}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-foreground">
                          {sale.number}
                        </span>
                        <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          {DOCUMENT_TYPE_LABELS[sale.document_type]}
                        </span>
                      </div>

                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground truncate max-w-[200px]">
                          {sale.customer.legal_name}
                        </span>
                        <span>•</span>
                        <span className="font-mono text-[11px]">
                          {sale.customer.identity_document_type_label}: {sale.customer.document_number}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Amounts, SUNAT Badge & Actions */}
                  <div className="flex items-center gap-4">
                    {/* Emitted date */}
                    <div className="text-right hidden sm:block font-mono text-xs text-muted-foreground">
                      <span className="block font-medium text-foreground">
                        {sale.issue_date ? formatDateTime(sale.issue_date) : "Hoy"}
                      </span>
                      <span className="text-[10px]">IGV {formatMoney(sale.totals.igv)}</span>
                    </div>

                    {/* Total Amount */}
                    <div className="text-right font-mono text-base font-extrabold text-foreground min-w-[90px]">
                      {formatMoney(sale.totals.total)}
                    </div>

                    {/* SUNAT Status Pill */}
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold shrink-0", statusCfg.className)}>
                      <StatusIcon className="size-3" />
                      {statusCfg.label}
                    </span>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => ticketMutation.mutate(sale.uuid)}
                        disabled={ticketMutation.isPending}
                        className="h-8 rounded-xl px-2.5 text-xs cursor-pointer hover:border-primary hover:text-primary"
                        title="Ver e imprimir ticket"
                      >
                        <Printer className="size-3.5 mr-1" />
                        Ticket
                      </Button>

                      {sale.sunat.status !== "ANNULLED" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (window.confirm(`¿Confirmas la anulación del comprobante ${sale.number}? Las existencias se restituirán al Kardex.`)) {
                              voidMutation.mutate(sale.uuid);
                            }
                          }}
                          disabled={voidMutation.isPending}
                          className="h-8 rounded-xl px-2.5 text-xs text-red-600 hover:bg-red-500/10 hover:text-red-700 cursor-pointer"
                          title="Anular comprobante"
                        >
                          <Ban className="size-3.5" />
                        </Button>
                      )}
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
              disabled={(pagination?.current_page ?? 1) <= 1 || salesQuery.isFetching}
              onClick={() => setPage((curr) => Math.max(1, curr - 1))}
              className="rounded-xl cursor-pointer"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={(pagination?.current_page ?? 1) >= (pagination?.last_page ?? 1) || salesQuery.isFetching}
              onClick={() => setPage((curr) => curr + 1)}
              className="rounded-xl cursor-pointer"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Thermal Ticket Modal */}
      <ThermalTicketDialog
        open={ticketOpen}
        onOpenChange={(open) => {
          setTicketOpen(open);
          if (!open) {
            setTicket(null);
          }
        }}
        ticket={ticket}
      />
    </div>
  );
}
