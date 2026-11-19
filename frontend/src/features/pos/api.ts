import { apiGet, apiPost, apiRequestWithMeta } from "@/api/client";
import type { PaginationMeta } from "@/types/api";
import type { InventorySummary } from "@/types/inventory";
import type {
  CashRegister,
  CashSession,
  CreateSalePayload,
  Customer,
  CustomerLookup,
  DocumentType,
  KardexFilters,
  KardexMovement,
  PaginatedList,
  PosProduct,
  Sale,
  SaleCreationResult,
  SaleFilters,
  SaleTicket,
  SunatStatus,
  Warehouse,
} from "@/types/pos";

type QueryValue = string | number | null | undefined;

function cleanParams(filters: Record<string, QueryValue>): Record<string, string | number> {
  return Object.entries(filters).reduce<Record<string, string | number>>(
    (accumulator, [key, value]) => {
      if (value === null || value === undefined || value === "") {
        return accumulator;
      }

      accumulator[key] = value as string | number;

      return accumulator;
    },
    {},
  );
}

function readPagination(meta: Record<string, unknown>, rows: number): PaginationMeta {
  const candidate = meta.pagination;

  if (typeof candidate === "object" && candidate !== null) {
    const pagination = candidate as Partial<PaginationMeta>;

    return {
      current_page: pagination.current_page ?? 1,
      per_page: pagination.per_page ?? rows,
      last_page: pagination.last_page ?? 1,
      total: pagination.total ?? rows,
      from: pagination.from ?? (rows > 0 ? 1 : null),
      to: pagination.to ?? (rows > 0 ? rows : null),
    };
  }

  return {
    current_page: 1,
    per_page: rows,
    last_page: 1,
    total: rows,
    from: rows > 0 ? 1 : null,
    to: rows > 0 ? rows : null,
  };
}

export async function fetchProducts(search = "", warehouseUuid?: string): Promise<{
  products: PosProduct[];
  warehouse: Warehouse | null;
}> {
  const { data, meta } = await apiRequestWithMeta<PosProduct[]>({
    method: "GET",
    url: "/pos/products",
    params: cleanParams({ search, warehouse_uuid: warehouseUuid, limit: 60 }),
  });

  const warehouse = meta.warehouse;

  return {
    products: data,
    warehouse:
      typeof warehouse === "object" && warehouse !== null
        ? (warehouse as Warehouse)
        : null,
  };
}

export function fetchCustomers(search = ""): Promise<Customer[]> {
  return apiGet<Customer[]>("/pos/customers", undefined, {
    params: cleanParams({ search, limit: 20 }),
  });
}

export function lookupCustomer(documentNumber: string): Promise<CustomerLookup> {
  return apiGet<CustomerLookup>("/pos/customers/lookup", undefined, {
    params: cleanParams({ document_number: documentNumber }),
  });
}

export interface CreateCustomerPayload {
  identity_document_type: string;
  document_number: string;
  legal_name: string;
  address?: string;
  email?: string;
  phone?: string;
}

export function createCustomer(payload: CreateCustomerPayload): Promise<Customer> {
  return apiPost<Customer>("/pos/customers", payload);
}

export function fetchCashRegisters(): Promise<CashRegister[]> {
  return apiGet<CashRegister[]>("/pos/cash-registers");
}

export function fetchCurrentCashSession(): Promise<CashSession | null> {
  return apiGet<CashSession | null>("/pos/cash-sessions/current");
}

export function openCashSession(
  cashRegisterUuid: string,
  openingBalance: string,
): Promise<CashSession> {
  return apiPost<CashSession>("/pos/cash-sessions/open", {
    cash_register_uuid: cashRegisterUuid,
    opening_balance: openingBalance,
  });
}

export function closeCashSession(
  sessionUuid: string,
  actualClosingBalance: string,
  notes?: string,
): Promise<CashSession> {
  return apiPost<CashSession>(`/pos/cash-sessions/${sessionUuid}/close`, {
    actual_closing_balance: actualClosingBalance,
    notes,
  });
}

export function createSale(
  payload: CreateSalePayload,
  idempotencyKey?: string,
): Promise<SaleCreationResult> {
  return apiPost<SaleCreationResult>(
    "/pos/sales",
    payload,
    undefined,
    idempotencyKey ? { headers: { "X-Idempotency-Key": idempotencyKey } } : {},
  );
}

export function voidSale(
  saleUuid: string,
  reason = "Anulación de la operación",
): Promise<{ sale: Sale; ticket: SaleTicket }> {
  return apiPost<{ sale: Sale; ticket: SaleTicket }>(`/pos/sales/${saleUuid}/void`, { reason });
}


export async function fetchSales(filters: SaleFilters): Promise<PaginatedList<Sale>> {
  const { data, meta } = await apiRequestWithMeta<Sale[]>({
    method: "GET",
    url: "/pos/sales",
    params: cleanParams({
      date_from: filters.date_from,
      date_to: filters.date_to,
      series: filters.series,
      document_type: filters.document_type,
      sunat_status: filters.sunat_status,
      search: filters.search,
      per_page: filters.per_page ?? 20,
      page: filters.page ?? 1,
    }),
  });

  return {
    rows: data,
    pagination: readPagination(meta, data.length),
  };
}

export async function fetchKardex(filters: KardexFilters): Promise<PaginatedList<KardexMovement>> {
  const { data, meta } = await apiRequestWithMeta<KardexMovement[]>({
    method: "GET",
    url: "/inventory/kardex",
    params: cleanParams({
      product_uuid: filters.product_uuid,
      warehouse_uuid: filters.warehouse_uuid,
      date_from: filters.date_from,
      date_to: filters.date_to,
      movement_type: filters.movement_type,
      per_page: filters.per_page ?? 25,
      page: filters.page ?? 1,
    }),
  });

  return {
    rows: data,
    pagination: readPagination(meta, data.length),
  };
}

export function fetchWarehouses(): Promise<Warehouse[]> {
  return apiGet<Warehouse[]>("/inventory/warehouses");
}

export function fetchPosWarehouses(): Promise<Warehouse[]> {
  return apiGet<Warehouse[]>("/pos/warehouses");
}

export function fetchInventorySummary(): Promise<InventorySummary> {
  return apiGet<InventorySummary>("/inventory/summary");
}

export function fetchSaleTicket(saleUuid: string): Promise<SaleTicket> {
  return apiGet<SaleTicket>(`/pos/sales/${saleUuid}/ticket`);
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  "00": "Nota interna",
  "01": "Factura",
  "03": "Boleta",
};

export const SUNAT_STATUS_LABELS: Record<SunatStatus, string> = {
  INTERNAL: "Control interno",
  PENDING: "Pendiente",
  ACCEPTED: "Aceptado",
  OBSERVED: "Observado",
  REJECTED: "Rechazado",
  ANNULLED: "Anulado",
};
