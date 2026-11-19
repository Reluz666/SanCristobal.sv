import type { Company } from "@/types/tenant";

export interface Branding {
  name: string;
  shortName: string;
  ruc: string;
  logoUrl: string | null;
  primaryColor: string;
}

const APP_NAME = import.meta.env.VITE_APP_NAME ?? "Ventas POS Pro";
const BRANDING_STORAGE_KEY = "ventas-pos.public-branding";
export const FALLBACK_LOGO_URL = import.meta.env.VITE_APP_LOGO_URL ?? "/logo.png";
export const APP_TAGLINE = import.meta.env.VITE_APP_TAGLINE ?? "Sistema de ventas";

const DEFAULT_PRIMARY_COLOR = sanitizeColor(import.meta.env.VITE_PRIMARY_COLOR) ?? "#03B7A3";

interface CachedCompanyBranding {
  display_name: string;
  legal_name: string;
  ruc: string;
  logo_url: string | null;
  primary_color: string;
}

export const DEFAULT_BRANDING: Branding = {
  name: APP_NAME,
  shortName: "VP",
  ruc: "",
  logoUrl: null,
  primaryColor: DEFAULT_PRIMARY_COLOR,
};

function sanitizeLogoUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value, window.location.origin);

    if (url.protocol === "https:" || url.protocol === "http:") {
      return url.toString();
    }
  } catch {
    return null;
  }

  return null;
}

function sanitizeColor(value: string | null | undefined): string | null {
  return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : null;
}

export function cacheCompanyBranding(company: Company): void {
  try {
    window.localStorage.setItem(BRANDING_STORAGE_KEY, JSON.stringify({
      display_name: company.branding.display_name,
      legal_name: company.legal_name,
      ruc: company.ruc,
      logo_url: company.branding.logo_url,
      primary_color: company.branding.primary_color,
    } satisfies CachedCompanyBranding));
  } catch {
    // Branding remains available from the authenticated company response.
  }
}

function readCachedCompanyBranding(): CachedCompanyBranding | null {
  try {
    const raw = window.localStorage.getItem(BRANDING_STORAGE_KEY);
    if (!raw) return null;

    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;

    const cached = value as Partial<CachedCompanyBranding>;
    if (typeof cached.display_name !== "string" || cached.display_name.trim() === "") return null;

    return {
      display_name: cached.display_name,
      legal_name: typeof cached.legal_name === "string" ? cached.legal_name : cached.display_name,
      ruc: typeof cached.ruc === "string" ? cached.ruc : "",
      logo_url: typeof cached.logo_url === "string" ? cached.logo_url : null,
      primary_color: sanitizeColor(cached.primary_color) ?? DEFAULT_PRIMARY_COLOR,
    };
  } catch {
    return null;
  }
}

function buildShortName(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);

  if (words.length === 0) {
    return DEFAULT_BRANDING.shortName;
  }

  if (words.length === 1) {
    return (words[0] ?? "").slice(0, 2).toUpperCase();
  }

  return `${(words[0] ?? "").charAt(0)}${(words[1] ?? "").charAt(0)}`.toUpperCase();
}

/**
 * Resuelve la marca blanca que el backend expone como configuración pública.
 * No confía en valores arbitrarios del JSON: valida URLs y colores.
 */
export function resolveBranding(company: Company | null | undefined): Branding {
  const cached = company ? null : readCachedCompanyBranding();
  const branding = company?.branding ?? cached;
  const name =
    branding?.display_name?.trim() ||
    company?.trade_name ||
    company?.legal_name ||
    cached?.legal_name ||
    APP_NAME;

  return {
    name,
    shortName: buildShortName(name),
    ruc: company?.ruc ?? cached?.ruc ?? "",
    logoUrl: sanitizeLogoUrl(branding?.logo_url),
    primaryColor: sanitizeColor(branding?.primary_color) ?? DEFAULT_BRANDING.primaryColor,
  };
}
