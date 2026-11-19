import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import type { z } from "zod";

import {
  AUTH_UNAUTHORIZED_EVENT,
  clearAuthToken,
  getAuthToken,
} from "@/api/auth-token";
import type { ApiEnvelope, ApiErrors } from "@/types/api";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") ??
  "http://localhost:8000/api/v1";

const DEFAULT_TIMEOUT_MS = 20_000;

export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: DEFAULT_TIMEOUT_MS,
  withCredentials: false,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
});

function createRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `req_${String(Date.now())}_${Math.random().toString(16).slice(2)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readEnvelope(value: unknown): Partial<ApiEnvelope<unknown>> | null {
  if (!isRecord(value)) {
    return null;
  }

  return value as Partial<ApiEnvelope<unknown>>;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string[]>;
  readonly traceId: string | null;
  readonly details: ApiErrors;

  constructor(options: {
    message: string;
    status: number;
    code: string;
    fields?: Record<string, string[]>;
    traceId?: string | null;
    details?: ApiErrors;
  }) {
    super(options.message);
    this.name = "ApiClientError";
    this.status = options.status;
    this.code = options.code;
    this.fields = options.fields ?? {};
    this.traceId = options.traceId ?? null;
    this.details = options.details ?? null;
  }
}

export function normalizeFieldErrors(errors: ApiErrors | undefined): Record<string, string[]> {
  if (errors === null || errors === undefined) {
    return {};
  }

  if (Array.isArray(errors)) {
    return errors.reduce<Record<string, string[]>>((accumulator, item, index) => {
      const field = readString(item.field) ?? readString(item.code) ?? `error_${String(index)}`;
      const message = readString(item.message);
      const messages = Array.isArray(item.messages)
        ? item.messages.filter((entry): entry is string => typeof entry === "string")
        : [];

      const resolved = messages.length > 0 ? messages : message !== null ? [message] : [];

      if (resolved.length > 0) {
        accumulator[field] = resolved;
      }

      return accumulator;
    }, {});
  }

  const fieldErrors = errors as unknown as Record<string, unknown>;

  return Object.entries(fieldErrors).reduce<Record<string, string[]>>(
    (accumulator, [field, value]) => {
      if (Array.isArray(value)) {
        const messages = value.filter((entry): entry is string => typeof entry === "string");

        if (messages.length > 0) {
          accumulator[field] = messages;
        }
      } else if (typeof value === "string" && value.trim() !== "") {
        accumulator[field] = [value];
      }

      return accumulator;
    },
    {},
  );
}

const STATUS_MESSAGES: Record<number, string> = {
  0: "No se pudo conectar con el servidor.",
  400: "La solicitud no pudo ser procesada.",
  401: "La sesión expiró. Inicia sesión nuevamente.",
  403: "No tienes autorización para realizar esta acción.",
  404: "El recurso solicitado no existe.",
  409: "La operación entra en conflicto con el estado actual.",
  422: "Revisa los datos ingresados.",
  429: "Demasiadas solicitudes. Espera unos instantes.",
  500: "Ocurrió un error interno. Intenta nuevamente.",
  503: "El servicio no está disponible en este momento.",
};

function defaultMessage(status: number): string {
  return STATUS_MESSAGES[status] ?? "La operación no pudo completarse.";
}

function isLoginRequest(config: AxiosRequestConfig | InternalAxiosRequestConfig): boolean {
  const url = config.url ?? "";

  return url.includes("/auth/login");
}

function buildClientError(error: unknown): ApiClientError {
  if (error instanceof ApiClientError) {
    return error;
  }

  if (error instanceof AxiosError) {
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      return new ApiClientError({
        message: "El servidor tardó demasiado en responder.",
        status: 0,
        code: "timeout",
      });
    }

    if (!error.response) {
      return new ApiClientError({
        message: defaultMessage(0),
        status: 0,
        code: "network_error",
      });
    }

    const { status, data, headers } = error.response;
    const envelope = readEnvelope(data);
    const message = readString(envelope?.message) ?? defaultMessage(status);
    const metaTraceId = envelope?.meta?.trace_id;
    const headerTraceId = headers["x-trace-id"];
    const traceId =
      readString(metaTraceId) ??
      (typeof headerTraceId === "string" ? headerTraceId : null);

    const clientError = new ApiClientError({
      message,
      status,
      code: `http_${String(status)}`,
      fields: normalizeFieldErrors(envelope?.errors),
      traceId,
      details: envelope?.errors ?? null,
    });

    if (status === 401 && !isLoginRequest(error.config ?? {})) {
      clearAuthToken();

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT));
      }
    }

    return clientError;
  }

  return new ApiClientError({
    message: "Ocurrió un error inesperado.",
    status: 0,
    code: "unexpected_error",
  });
}

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAuthToken();

  config.headers.set("X-Request-Id", createRequestId());

  if (token !== null) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }

  return config;
});

http.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: unknown) => Promise.reject(buildClientError(error)),
);

function assertSuccessEnvelope(value: unknown): asserts value is ApiEnvelope<unknown> {
  if (!isRecord(value) || value.success !== true || !("data" in value)) {
    throw new ApiClientError({
      message: "La respuesta del servidor no cumple el contrato esperado.",
      status: 0,
      code: "invalid_contract",
    });
  }
}

export async function apiRequest<T>(
  config: AxiosRequestConfig,
  schema: z.ZodType<T>,
): Promise<T>;
export async function apiRequest<T = unknown>(config: AxiosRequestConfig): Promise<T>;
export async function apiRequest<T = unknown>(
  config: AxiosRequestConfig,
  schema?: z.ZodType<T>,
): Promise<T> {
  const response = await http.request<unknown>(config);
  const envelope = response.data;

  assertSuccessEnvelope(envelope);

  if (schema === undefined) {
    return envelope.data as T;
  }

  const parsed = schema.safeParse(envelope.data);

  if (!parsed.success) {
    throw new ApiClientError({
      message: "La respuesta del servidor tiene un formato inesperado.",
      status: response.status,
      code: "invalid_contract",
      traceId: envelope.meta?.trace_id ?? null,
    });
  }

  return parsed.data;
}

export async function apiRequestWithMeta<T>(
  config: AxiosRequestConfig,
  schema?: z.ZodType<T>,
): Promise<{ data: T; meta: ApiEnvelope<T>["meta"]; message: string }> {
  const response = await http.request<unknown>(config);
  const envelope = response.data;

  assertSuccessEnvelope(envelope);

  if (schema === undefined) {
    return {
      data: envelope.data as T,
      meta: envelope.meta,
      message: envelope.message,
    };
  }

  const parsed = schema.safeParse(envelope.data);

  if (!parsed.success) {
    throw new ApiClientError({
      message: "La respuesta del servidor tiene un formato inesperado.",
      status: response.status,
      code: "invalid_contract",
      traceId: envelope.meta?.trace_id ?? null,
    });
  }

  return {
    data: parsed.data,
    meta: envelope.meta,
    message: envelope.message,
  };
}

export function apiGet<T>(
  url: string,
  schema?: z.ZodType<T>,
  config: AxiosRequestConfig = {},
): Promise<T> {
  if (schema === undefined) {
    return apiRequest<T>({ ...config, method: "GET", url });
  }

  return apiRequest<T>({ ...config, method: "GET", url }, schema);
}

export function apiPost<T>(
  url: string,
  data?: unknown,
  schema?: z.ZodType<T>,
  config: AxiosRequestConfig = {},
): Promise<T> {
  if (schema === undefined) {
    return apiRequest<T>({ ...config, method: "POST", url, data });
  }

  return apiRequest<T>({ ...config, method: "POST", url, data }, schema);
}
