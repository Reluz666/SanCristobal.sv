export interface CompanyBranding {
  display_name: string;
  logo_url: string | null;
  primary_color: string;
}

export interface CompanyPayments {
  yape_phone: string | null;
  plin_phone: string | null;
}

export type CurrencyCode = "PEN" | "USD";

export interface Company {
  uuid: string;
  ruc: string;
  legal_name: string;
  trade_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  ubigeo: string | null;
  currency: CurrencyCode;
  igv_percentage: string;
  timezone: string;
  features: {
    cash_sessions_enabled: boolean;
  };
  sunat: {
    mode: "simulate" | "auto" | "live";
    environment: "beta" | "production";
  };
  branding: CompanyBranding;
  payments: CompanyPayments;
  is_active: boolean;
  created_at: string | null;
}

export interface AuthUser {
  uuid: string;
  name: string;
  email: string;
  document_type: string | null;
  document_number: string | null;
  phone: string | null;
  is_active: boolean;
  last_login_at: string | null;
}

export interface AuthSession {
  token: string | null;
  token_type: "Bearer";
  expires_at: string | null;
  user: AuthUser;
  roles: string[];
  permissions: string[];
  company: Company;
}

export interface TenantContext {
  company: Company;
  user: AuthUser;
  roles: string[];
  permissions: string[];
}
