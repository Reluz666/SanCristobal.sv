import type { PaginationMeta } from "@/types/api";

export type DocumentType = "00" | "01" | "03";

export type PaymentMethod = "CASH" | "YAPE" | "PLIN" | "CARD" | "TRANSFER";

export type SunatStatus =
  | "INTERNAL"
  | "PENDING"
  | "ACCEPTED"
  | "OBSERVED"
  | "REJECTED"
  | "ANNULLED";

export type IdentityDocumentType = "0" | "1" | "4" | "6" | "7";

export type TaxAffectationType = "10" | "20" | "30";

export interface PosProduct {
  uuid: string;
  sku: string;
  barcode: string | null;
  name: string;
  unit_code: string;
  tax_affectation_type: TaxAffectationType;
  tax_affectation_label: string;
  sale_price: string;
  currency: string;
  min_stock: string;
  track_stock: boolean;
  stock: string;
  is_low_stock: boolean;
  category: { uuid: string; name: string } | null;
  unit: { code: string; name: string } | null;
}

export interface Customer {
  uuid: string;
  identity_document_type: IdentityDocumentType;
  identity_document_type_label: string;
  document_number: string;
  legal_name: string;
  address: string | null;
  ubigeo: string | null;
  email: string | null;
  phone: string | null;
  is_generic: boolean;
}

export interface IdentityLookup {
  identity_document_type: IdentityDocumentType;
  document_number: string;
  legal_name: string;
  address: string | null;
  is_demo: boolean;
}

export interface CustomerLookup {
  customer: Customer | null;
  identity: IdentityLookup | null;
}

export interface Warehouse {
  uuid: string;
  code: string;
  sunat_code: string | null;
  name: string;
  address: string | null;
  is_active: boolean;
}

export interface CashRegister {
  uuid: string;
  name: string;
  is_active: boolean;
  is_open: boolean;
  warehouse: Warehouse | null;
}

export interface CashSessionSummary {
  sales_count: number;
  cash_total: string;
  total_sales: string;
}

export interface CashSession {
  uuid: string;
  status: string;
  is_open: boolean;
  opened_at: string | null;
  closed_at: string | null;
  opening_balance: string;
  expected_closing_balance: string | null;
  actual_closing_balance: string | null;
  difference: string | null;
  notes: string | null;
  summary: CashSessionSummary | null;
  cash_register: {
    uuid: string;
    name: string;
    warehouse: Warehouse | null;
  };
  user: { uuid: string; name: string };
  created_at: string | null;
}

export interface CartLine {
  product: PosProduct;
  quantity: string;
}

export interface CartLineTotal {
  product: PosProduct;
  quantity: string;
  subtotal: string;
  igv: string;
  total: string;
  unitValue: string;
}

export interface CartTotals {
  lines: CartLineTotal[];
  taxed: string;
  exonerated: string;
  unaffected: string;
  igv: string;
  total: string;
  itemCount: string;
}

export interface SaleItem {
  description: string;
  unit_code: string;
  tax_affectation_type: TaxAffectationType;
  tax_affectation_label: string;
  quantity: string;
  unit_value: string;
  unit_price: string;
  igv_percentage: string;
  total_igv: string;
  subtotal: string;
  total: string;
  product: { uuid: string; sku: string; barcode: string | null } | null;
}

export interface SalePayment {
  payment_method: PaymentMethod;
  payment_method_label: string;
  amount: string;
  reference_number: string | null;
}

export interface Sale {
  uuid: string;
  number: string;
  document_type: DocumentType;
  document_type_label: string;
  series: string;
  correlative: number;
  issue_date: string | null;
  currency: string;
  exchange_rate: string;
  totals: {
    taxed: string;
    exonerated: string;
    unaffected: string;
    igv: string;
    discount: string;
    total: string;
  };
  sunat: {
    status: SunatStatus;
    status_label: string;
    hash: string | null;
    code: string | null;
    description: string | null;
    has_xml: boolean;
    has_cdr: boolean;
  };
  customer: Customer;
  cashier: { uuid: string; name: string };
  warehouse: Warehouse;
  items: SaleItem[];
  payments: SalePayment[];
  created_at: string | null;
}

export interface SaleTicket {
  company: {
    ruc: string;
    legal_name: string;
    trade_name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    logo_url: string | null;
  };
  document: {
    type: DocumentType;
    type_label: string;
    series: string;
    correlative: number;
    number: string;
    issue_date: string | null;
    currency: string;
    sunat_status: SunatStatus;
  };
  customer: {
    identity_document_type: IdentityDocumentType;
    identity_document_type_label: string;
    document_number: string;
    legal_name: string;
    address: string | null;
  };
  cashier: { name: string };
  items: {
    description: string;
    quantity: string;
    unit_code: string;
    unit_price: string;
    subtotal: string;
    igv: string;
    total: string;
  }[];
  totals: {
    taxed: string;
    exonerated: string;
    unaffected: string;
    igv: string;
    discount: string;
    total: string;
    amount_in_words: string;
  };
  payments: {
    payment_method: PaymentMethod;
    payment_method_label: string;
    amount: string;
    reference_number: string | null;
  }[];
  sunat: {
    status: SunatStatus;
    status_label: string;
    hash: string | null;
    code: string | null;
    description: string | null;
    qr_text: string;
    has_xml: boolean;
    has_cdr: boolean;
  };
  print: {
    width_mm: number;
    copies: number;
    footer: string;
  };
}

export interface SaleCreationResult {
  sale: Sale;
  ticket: SaleTicket;
}

export interface SaleFilters {
  date_from?: string;
  date_to?: string;
  series?: string;
  document_type?: DocumentType;
  sunat_status?: SunatStatus;
  search?: string;
  per_page?: number;
  page?: number;
}

export interface KardexMovement {
  uuid: string;
  movement_date: string | null;
  movement_type: string;
  movement_type_label: string;
  is_outbound: boolean;
  document_type: DocumentType | null;
  document_type_label: string | null;
  document_reference: string | null;
  quantity: string;
  unit_cost: string;
  total_cost: string;
  balance_quantity: string;
  balance_unit_cost: string;
  balance_total_cost: string;
  notes: string | null;
  product: { uuid: string; sku: string; name: string };
  warehouse: { uuid: string; name: string };
  user: { uuid: string; name: string };
}

export interface KardexFilters {
  product_uuid?: string;
  warehouse_uuid?: string;
  date_from?: string;
  date_to?: string;
  movement_type?: string;
  per_page?: number;
  page?: number;
}

export interface PaginatedList<T> {
  rows: T[];
  pagination: PaginationMeta;
}

export interface CreateSalePayload {
  document_type: DocumentType;
  warehouse_uuid?: string;
  customer_uuid?: string;
  items: { product_uuid: string; quantity: string }[];
  payments: {
    payment_method: PaymentMethod;
    amount: string;
    reference_number?: string;
  }[];
  notes?: string;
}

export interface PaymentDraft {
  id: string;
  method: PaymentMethod;
  amount: string;
  referenceNumber: string;
}
