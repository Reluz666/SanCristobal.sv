import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CompanyBrandingSync } from "@/components/layout/CompanyBrandingSync";
import { cacheCompanyBranding, resolveBranding } from "@/lib/branding";
import { useAuthStore } from "@/stores/authStore";
import type { Company } from "@/types/tenant";

function makeCompany(overrides: Partial<Company> = {}): Company {
  return {
    uuid: "company-uuid",
    ruc: "20123456789",
    legal_name: "Empresa de Prueba S.A.C.",
    trade_name: "Empresa de Prueba",
    email: null,
    phone: null,
    address: null,
    ubigeo: null,
    currency: "PEN",
    igv_percentage: "18.00",
    timezone: "America/Lima",
    features: { cash_sessions_enabled: false },
    sunat: { mode: "simulate", environment: "beta" },
    branding: {
      display_name: "Empresa de Prueba",
      logo_url: "/brand.svg",
      primary_color: "#125678",
    },
    payments: { yape_phone: null, plin_phone: null },
    is_active: true,
    created_at: null,
    ...overrides,
  };
}

describe("company branding", () => {
  beforeEach(() => {
    useAuthStore.setState({ company: null });
  });

  afterEach(() => {
    cleanup();
    useAuthStore.setState({ company: null });
    document.documentElement.removeAttribute("style");
  });

  it("resolves and sanitizes the authenticated company's branding", () => {
    const branding = resolveBranding(makeCompany());

    expect(branding.name).toBe("Empresa de Prueba");
    expect(branding.logoUrl).toBe(`${window.location.origin}/brand.svg`);
    expect(branding.primaryColor).toBe("#125678");
  });

  it("falls back safely when the stored color or logo URL is invalid", () => {
    const company = makeCompany({
      branding: {
        display_name: "Empresa de Prueba",
        logo_url: "javascript:alert(1)",
        primary_color: "red",
      },
    });

    const branding = resolveBranding(company);

    expect(branding.logoUrl).toBeNull();
    expect(branding.primaryColor).toBe("#03B7A3");
  });

  it("synchronizes company branding into the document and public cache", () => {
    const company = makeCompany();
    useAuthStore.setState({ company });

    render(<CompanyBrandingSync />);

    expect(document.title).toBe("Empresa de Prueba");
    expect(document.documentElement.style.getPropertyValue("--primary")).toBe("#125678");
    expect(JSON.parse(window.localStorage.getItem("ventas-pos.public-branding") ?? "{}")).toMatchObject({
      display_name: "Empresa de Prueba",
      ruc: "20123456789",
    });
  });

  it("uses cached branding before authentication", () => {
    cacheCompanyBranding(makeCompany());

    expect(resolveBranding(null)).toMatchObject({
      name: "Empresa de Prueba",
      ruc: "20123456789",
    });
  });
});
