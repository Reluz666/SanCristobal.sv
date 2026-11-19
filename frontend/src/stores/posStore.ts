import { create } from "zustand";

import { decimal } from "@/lib/decimal";
import type {
  CartLine,
  Customer,
  DocumentType,
  PosProduct,
  Sale,
  SaleTicket,
} from "@/types/pos";

interface PosState {
  documentType: DocumentType;
  warehouseUuid: string | null;
  customer: Customer | null;
  lines: CartLine[];
  lastSale: Sale | null;
  lastTicket: SaleTicket | null;
  setDocumentType: (documentType: DocumentType) => void;
  setWarehouseUuid: (warehouseUuid: string | null) => void;
  setCustomer: (customer: Customer | null) => void;
  addProduct: (product: PosProduct, quantity?: string) => void;
  setQuantity: (productUuid: string, quantity: string) => void;
  increment: (productUuid: string) => void;
  decrement: (productUuid: string) => void;
  removeProduct: (productUuid: string) => void;
  clearCart: () => void;
  completeSale: (sale: Sale, ticket: SaleTicket) => void;
  dismissLastTicket: () => void;
}

function normalizeQuantity(raw: string): string {
  const sanitized = raw.replace(",", ".").replace(/[^\d.]/g, "");
  const [integer = "0", fraction = ""] = sanitized.split(".");
  const whole = integer === "" ? "0" : integer;
  const normalizedFraction = fraction.padEnd(4, "0").slice(0, 4);

  return `${whole}.${normalizedFraction}`;
}

export const usePosStore = create<PosState>()((set, get) => ({
  documentType: "03",
  warehouseUuid: null,
  customer: null,
  lines: [],
  lastSale: null,
  lastTicket: null,

  setDocumentType: (documentType) => {
    set({ documentType });
  },

  setWarehouseUuid: (warehouseUuid) => {
    set({ warehouseUuid });
  },

  setCustomer: (customer) => {
    set({ customer });
  },

  addProduct: (product, quantity = "1") => {
    const normalizedQuantity = normalizeQuantity(quantity);
    const existing = get().lines.find((line) => line.product.uuid === product.uuid);

    if (existing) {
      const next = decimal(existing.quantity).plus(normalizedQuantity).toFixed(4);
      get().setQuantity(product.uuid, next);
      return;
    }

    set((state) => ({
      lines: [...state.lines, { product, quantity: normalizedQuantity }],
    }));
  },

  setQuantity: (productUuid, quantity) => {
    const normalized = normalizeQuantity(quantity);

    set((state) => ({
      lines: state.lines.map((line) =>
        line.product.uuid === productUuid ? { ...line, quantity: normalized } : line,
      ),
    }));
  },

  increment: (productUuid) => {
    const line = get().lines.find((entry) => entry.product.uuid === productUuid);

    if (line) {
      get().setQuantity(productUuid, decimal(line.quantity).plus(1).toFixed(4));
    }
  },

  decrement: (productUuid) => {
    const line = get().lines.find((entry) => entry.product.uuid === productUuid);

    if (!line) {
      return;
    }

    const next = decimal(line.quantity).minus(1);

    if (next.isNegative() || next.isZero()) {
      get().removeProduct(productUuid);
      return;
    }

    get().setQuantity(productUuid, next.toFixed(4));
  },

  removeProduct: (productUuid) => {
    set((state) => ({
      lines: state.lines.filter((line) => line.product.uuid !== productUuid),
    }));
  },

  clearCart: () => {
    set({ lines: [], customer: null, documentType: "03" });
  },

  completeSale: (sale, ticket) => {
    set({
      lastSale: sale,
      lastTicket: ticket,
      lines: [],
      customer: null,
      documentType: "03",
    });
  },

  dismissLastTicket: () => {
    set({ lastTicket: null });
  },
}));
