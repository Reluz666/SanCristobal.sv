import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClientError } from "@/api/client";
import { CheckoutModal } from "@/features/pos/CheckoutModal";
import { createSale } from "@/features/pos/api";
import { usePosStore } from "@/stores/posStore";
import type { PosProduct, SaleCreationResult } from "@/types/pos";
import { renderWithProviders } from "@/test/renderWithProviders";

vi.mock("@/features/pos/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/pos/api")>();
  return { ...actual, createSale: vi.fn() };
});

vi.mock("@/hooks/use-hotkeys", () => ({ useHotkeys: vi.fn() }));
vi.mock("@/lib/sound", () => ({ playSound: vi.fn() }));

const product: PosProduct = {
  uuid: "product-1",
  sku: "SKU-1",
  barcode: null,
  name: "Producto de prueba",
  unit_code: "NIU",
  tax_affectation_type: "20",
  tax_affectation_label: "Exonerado",
  sale_price: "10.00",
  currency: "PEN",
  min_stock: "0.0000",
  track_stock: true,
  stock: "20.0000",
  is_low_stock: false,
  category: null,
  unit: null,
};

function makeResult(): SaleCreationResult {
  return { sale: {} as SaleCreationResult["sale"], ticket: {} as SaleCreationResult["ticket"] };
}

function resetCart(price = "10.00") {
  usePosStore.setState({
    documentType: "03",
    warehouseUuid: "warehouse-1",
    customer: null,
    lines: [],
    lastSale: null,
    lastTicket: null,
  });
  usePosStore.getState().addProduct({ ...product, sale_price: price });
}

describe("checkout modal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCart();
  });

  it("submits a sale paid with two methods and includes the digital reference", async () => {
    const user = userEvent.setup();
    const completed = vi.fn();
    const result = makeResult();
    vi.mocked(createSale).mockResolvedValue(result);

    renderWithProviders(
      <CheckoutModal open warehouseUuid="warehouse-1" onOpenChange={vi.fn()} onCompleted={completed} />,
    );

    await user.click(screen.getAllByRole("combobox")[0]!);
    await user.click(await screen.findByRole("option", { name: "Yape" }));
    await user.type(screen.getByLabelText("Importe del nuevo pago"), "5.00");
    await user.type(screen.getByPlaceholderText("Número de operación"), "YAPE-123");
    await user.click(screen.getByRole("button", { name: "Agregar medio de pago" }));

    await user.click(screen.getAllByRole("button", { name: /Agregar medio de pago/ })[0]!);
    await user.click(screen.getByRole("button", { name: /Emitir Boleta/ }));

    await waitFor(() => expect(createSale).toHaveBeenCalledOnce());
    expect(vi.mocked(createSale).mock.calls[0]?.[0]).toMatchObject({
      document_type: "03",
      warehouse_uuid: "warehouse-1",
      items: [{ product_uuid: "product-1", quantity: "1.0000" }],
      payments: [
        { payment_method: "YAPE", amount: "5.00", reference_number: "YAPE-123" },
        { payment_method: "CASH", amount: "5.00" },
      ],
    });
    expect(completed).toHaveBeenCalledWith(result);
  });

  it("shows the server's sale error and keeps the cart for correction", async () => {
    const user = userEvent.setup();
    vi.mocked(createSale).mockRejectedValue(
      new ApiClientError({ message: "Stock insuficiente", status: 422, code: "validation_error" }),
    );

    renderWithProviders(
      <CheckoutModal open onOpenChange={vi.fn()} onCompleted={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: "Efectivo exacto" }));
    await user.click(screen.getByRole("button", { name: /Emitir Boleta/ }));

    expect(await screen.findByText("Stock insuficiente")).toBeInTheDocument();
    expect(usePosStore.getState().lines).toHaveLength(1);
  });

  it("blocks a receipt over S/ 700 until the customer is identified", () => {
    resetCart("701.00");

    renderWithProviders(
      <CheckoutModal open onOpenChange={vi.fn()} onCompleted={vi.fn()} />,
    );

    expect(screen.getByText(/supera S\/ 700\.00/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Emitir Boleta/ })).toBeDisabled();
  });
});
