import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchCurrentCashSession, fetchPosWarehouses, fetchProducts } from "@/features/pos/api";
import { PosTerminalPage } from "@/features/pos/PosTerminalPage";
import { useAuthStore } from "@/stores/authStore";
import { usePosStore } from "@/stores/posStore";
import type { Company } from "@/types/tenant";
import type { Warehouse } from "@/types/pos";
import { renderWithProviders } from "@/test/renderWithProviders";

vi.mock("@/features/pos/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/pos/api")>();
  return {
    ...actual,
    fetchCurrentCashSession: vi.fn(),
    fetchPosWarehouses: vi.fn(),
    fetchProducts: vi.fn(),
  };
});
vi.mock("@/features/pos/CheckoutModal", () => ({ CheckoutModal: () => null }));
vi.mock("@/features/pos/CustomerDialog", () => ({ CustomerDialog: () => null }));
vi.mock("@/features/pos/ThermalTicketDialog", () => ({ ThermalTicketDialog: () => null }));
vi.mock("@/hooks/useBarcodeScanner", () => ({
  useBarcodeScanner: () => ({ inputRef: { current: null }, focusInput: vi.fn() }),
}));
vi.mock("@/hooks/usePosHotkeys", () => ({ usePosHotkeys: vi.fn() }));
vi.mock("@/lib/sound", () => ({
  isSoundEnabled: () => false,
  playSound: vi.fn(),
  setSoundEnabled: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() } }));

const warehouses: Warehouse[] = [
  {
    uuid: "warehouse-1",
    code: "A",
    sunat_code: "0000",
    name: "Almacén principal",
    address: null,
    is_active: true,
  },
  {
    uuid: "warehouse-2",
    code: "B",
    sunat_code: "0001",
    name: "Almacén secundario",
    address: null,
    is_active: true,
  },
];

describe("POS warehouse selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      company: { uuid: "company-1", features: { cash_sessions_enabled: false } } as Company,
    });
    usePosStore.setState({
      warehouseUuid: null,
      documentType: "03",
      customer: null,
      lines: [],
      lastSale: null,
      lastTicket: null,
    });
    vi.mocked(fetchCurrentCashSession).mockResolvedValue(null);
    vi.mocked(fetchPosWarehouses).mockResolvedValue(warehouses);
    vi.mocked(fetchProducts).mockImplementation(async (_search, warehouseUuid) => ({
      products: [],
      warehouse: warehouses.find((warehouse) => warehouse.uuid === warehouseUuid) ?? null,
    }));
  });

  it("requires an explicit warehouse, then loads the catalog for that warehouse", async () => {
    const user = userEvent.setup();
    renderWithProviders(<PosTerminalPage />, { route: "/pos" });

    expect(await screen.findByText("Selecciona el almacén para consultar el stock y habilitar la venta.")).toBeInTheDocument();
    expect(fetchProducts).not.toHaveBeenCalled();

    await user.click(screen.getByRole("combobox", { name: "Almacén de salida" }));
    await user.click(await screen.findByRole("option", { name: "A · Almacén principal" }));

    await waitFor(() => expect(fetchProducts).toHaveBeenCalledWith("", "warehouse-1"));
    expect(usePosStore.getState().warehouseUuid).toBe("warehouse-1");
    expect(screen.queryByText("Selecciona el almacén para consultar el stock y habilitar la venta.")).not.toBeInTheDocument();
  });
});
