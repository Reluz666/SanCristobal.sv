import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchSaleTicket, fetchSales } from "@/features/pos/api";
import { fetchDashboardSummary } from "@/features/overview/api";
import { useAuthStore } from "@/stores/authStore";
import type { Company } from "@/types/tenant";
import type { DashboardSummary } from "@/types/overview";
import { renderWithProviders } from "@/test/renderWithProviders";
import { OverviewPage } from "@/features/overview/OverviewPage";

vi.mock("@/features/overview/api", () => ({ fetchDashboardSummary: vi.fn() }));
vi.mock("@/features/pos/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/pos/api")>();
  return {
    ...actual,
    fetchSaleTicket: vi.fn(),
    fetchSales: vi.fn(),
  };
});
vi.mock("@/features/pos/ThermalTicketDialog", () => ({ ThermalTicketDialog: () => null }));

function makeSummary(overrides: Partial<DashboardSummary> = {}): DashboardSummary {
  return {
    business_date: "2026-11-19",
    timezone: "America/Lima",
    currency: "PEN",
    generated_at: "2026-11-19T12:00:00-05:00",
    warehouse: { uuid: "warehouse-1", name: "Almacén principal" },
    permissions: { sales: true, products: true },
    sales: { count: 7, total: "125.50", average_ticket: "17.93" },
    hourly_sales: [
      { range: "00:00 - 04:00", count: 0, total: "0.00" },
      { range: "04:00 - 08:00", count: 1, total: "10.00" },
      { range: "08:00 - 12:00", count: 3, total: "45.00" },
      { range: "12:00 - 16:00", count: 8, total: "100.00" },
      { range: "16:00 - 20:00", count: 2, total: "20.00" },
      { range: "20:00 - 24:00", count: 0, total: "0.00" },
    ],
    active_products_count: 12,
    top_products: [],
    stock: { tracked_products_count: 12, low_stock_count: 0, low_stock_products: [] },
    ...overrides,
  };
}

describe("dashboard summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      company: { uuid: "company-1" } as Company,
      user: { name: "Ana Reluz" } as never,
      roles: ["admin"],
      permissions: [],
    });
    vi.mocked(fetchSales).mockResolvedValue({
      rows: [],
      pagination: { current_page: 1, per_page: 25, last_page: 1, total: 0, from: null, to: null },
    });
    vi.mocked(fetchSaleTicket).mockResolvedValue({} as Awaited<ReturnType<typeof fetchSaleTicket>>);
  });

  it("renders the server's daily totals and identifies the busiest time slot", async () => {
    vi.mocked(fetchDashboardSummary).mockResolvedValue(makeSummary());

    renderWithProviders(<OverviewPage />);

    expect(await screen.findByText("7 ventas")).toBeInTheDocument();
    expect(screen.getByText("PICO").parentElement).toHaveTextContent("12:00 - 16:00");
    expect(screen.getByText("Pulso Comercial del Día")).toBeInTheDocument();
  });

  it("does not request recent sales or expose sales and stock values without permission", async () => {
    vi.mocked(fetchDashboardSummary).mockResolvedValue(
      makeSummary({
        permissions: { sales: false, products: false },
        sales: null,
        hourly_sales: [],
        active_products_count: null,
        top_products: [],
        stock: null,
      }),
    );

    renderWithProviders(<OverviewPage />);

    expect(await screen.findByText("No tienes permiso para consultar las ventas recientes.")).toBeInTheDocument();
    expect(await screen.findByText("No tienes permiso para consultar el inventario.")).toBeInTheDocument();
    expect(fetchSales).not.toHaveBeenCalled();
    expect(screen.getAllByText("Sin acceso").length).toBeGreaterThan(0);
  });
});
