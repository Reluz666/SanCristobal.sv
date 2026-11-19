export type ApiFieldErrors = Record<string, string[]>;

export interface ApiErrorItem {
  code?: string;
  field?: string;
  message?: string;
  messages?: string[];
  detail?: string;
  [key: string]: unknown;
}

export type ApiErrors = ApiErrorItem[] | ApiFieldErrors | null;

export interface ApiMeta {
  timestamp: string;
  trace_id: string;
  [key: string]: unknown;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T | null;
  errors: ApiErrors;
  meta: ApiMeta;
}

export interface PaginationMeta {
  current_page: number;
  per_page: number;
  last_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

export interface HealthPayload {
  service: string;
  api_version: string;
  status: "available" | "degraded" | "unavailable";
  timestamp: string;
}

export interface AuthSession {
  token: string;
  token_type: "Bearer";
  expires_at: string | null;
}

export interface LoginPayload {
  email: string;
  password: string;
  remember: boolean;
}
