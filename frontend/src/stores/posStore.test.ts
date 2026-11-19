import { beforeEach, describe, expect, it } from "vitest";

import { usePosStore } from "@/stores/posStore";
import type { PosProduct } from "@/types/pos";

const product: PosProduct = {
  uuid: "product-uuid",
  sku: "SKU-001",
  barcode: null,
  name: "Producto de prueba",
  unit_code: "NIU",
  tax_affectation_type: "10",
  tax_affectation_label: "Gravado",
  sale_price: "12.50",
  currency: "PEN",
  min_stock: "0.0000",
  track_stock: true,
  stock: "20.0000",
  is_low_stock: false,
  category: null,
  unit: null,
};

describe("POS cart store", () => {
  beforeEach(() => {
    usePosStore.setState({
      documentType: "03",
      warehouseUuid: null,
      customer: null,
      lines: [],
      lastSale: null,
      lastTicket: null,
    });
  });

  it("combines duplicate products and keeps four decimal places", () => {
    usePosStore.getState().addProduct(product, "1.25");
    usePosStore.getState().addProduct(product, "2,5");

    expect(usePosStore.getState().lines).toHaveLength(1);
    expect(usePosStore.getState().lines[0]?.quantity).toBe("3.7500");
  });

  it("removes a line when decrement reaches zero", () => {
    usePosStore.getState().addProduct(product, "1");
    usePosStore.getState().decrement(product.uuid);

    expect(usePosStore.getState().lines).toEqual([]);
  });

  it("clears customer and restores the default document type with the cart", () => {
    usePosStore.getState().setDocumentType("01");
    usePosStore.getState().addProduct(product);
    usePosStore.getState().clearCart();

    expect(usePosStore.getState().lines).toEqual([]);
    expect(usePosStore.getState().customer).toBeNull();
    expect(usePosStore.getState().documentType).toBe("03");
  });

  it("keeps the selected warehouse when the cart is cleared", () => {
    usePosStore.getState().setWarehouseUuid("warehouse-uuid");
    usePosStore.getState().addProduct(product);
    usePosStore.getState().clearCart();

    expect(usePosStore.getState().warehouseUuid).toBe("warehouse-uuid");
  });
});
