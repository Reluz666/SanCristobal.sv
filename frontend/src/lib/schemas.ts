import { z } from "zod";

import type { ApiEnvelope, ApiErrors } from "@/types/api";
import type { AuthSession, Company } from "@/types/tenant";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const apiErrorsSchema = z.union([
  z.array(z.record(z.string(), z.unknown())),
  z.record(z.string(), z.array(z.string())),
  z.null(),
]);

export const apiMetaSchema = z
  .object({
    timestamp: z.string().min(1),
    trace_id: z.string().min(1),
  })
  .catchall(z.unknown());

export const healthSchema = z.object({
  service: z.string().min(1),
  api_version: z.string().min(1),
  status: z.enum(["available", "degraded", "unavailable"]),
  timestamp: z.string().min(1),
});

/**
 * Validación de entrada del login. El backend vuelve a validar con
 * FormRequest: Zod mejora la ergonomía, nunca sustituye la defensa servidor.
 */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Ingresa tu correo corporativo.")
    .max(254, "El correo no puede superar los 254 caracteres.")
    .regex(emailPattern, "El formato del correo no es válido."),
  password: z
    .string()
    .min(1, "Ingresa tu contraseña.")
    .max(255, "La contraseña no puede superar los 255 caracteres."),
});

/**
 * Debe reflejar Password::defaults() del backend: 12 caracteres,
 * mayúsculas, minúsculas, números y símbolos.
 */
export const strongPasswordSchema = z
  .string()
  .min(12, "La contraseña debe tener al menos 12 caracteres.")
  .max(255)
  .regex(/[a-z]/, "Debe incluir al menos una minúscula.")
  .regex(/[A-Z]/, "Debe incluir al menos una mayúscula.")
  .regex(/\d/, "Debe incluir al menos un número.")
  .regex(/[^A-Za-z0-9]/, "Debe incluir al menos un símbolo.");

export const rucSchema = z
  .string()
  .trim()
  .regex(/^\d{11}$/, "El RUC debe tener exactamente 11 dígitos.");

export const companyBrandingSchema = z.object({
  display_name: z.string().min(1),
  logo_url: z.string().nullable(),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const companySchema = z.object({
  uuid: z.string().uuid(),
  ruc: rucSchema,
  legal_name: z.string().min(1),
  trade_name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  ubigeo: z.string().nullable(),
  currency: z.enum(["PEN", "USD"]),
  igv_percentage: z.string(),
  timezone: z.string().min(1),
  features: z.object({ cash_sessions_enabled: z.boolean() }),
  sunat: z.object({
    mode: z.enum(["simulate", "auto", "live"]),
    environment: z.enum(["beta", "production"]),
  }),
  branding: companyBrandingSchema,
  payments: z.object({
    yape_phone: z.string().nullable(),
    plin_phone: z.string().nullable(),
  }),
  is_active: z.boolean(),
  created_at: z.string().nullable(),
});

export const authUserSchema = z.object({
  uuid: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().regex(emailPattern),
  document_type: z.string().nullable(),
  document_number: z.string().nullable(),
  phone: z.string().nullable(),
  is_active: z.boolean(),
  last_login_at: z.string().nullable(),
});

export const authSessionSchema = z.object({
  token: z.string().min(1).nullable(),
  token_type: z.literal("Bearer"),
  expires_at: z.string().nullable(),
  user: authUserSchema,
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
  company: companySchema,
});

export const paginationMetaSchema = z.object({
  current_page: z.number().int().nonnegative(),
  per_page: z.number().int().positive(),
  last_page: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  from: z.number().int().nonnegative().nullable(),
  to: z.number().int().nonnegative().nullable(),
});

/**
 * Valida el contrato único del API y conserva el tipo del payload.
 */
export function apiEnvelopeSchema<T>(dataSchema: z.ZodType<T>): z.ZodType<ApiEnvelope<T>> {
  const schema = z.object({
    success: z.boolean(),
    message: z.string(),
    data: dataSchema.nullable(),
    errors: apiErrorsSchema,
    meta: apiMetaSchema,
  });

  return schema as unknown as z.ZodType<ApiEnvelope<T>>;
}

export type LoginFormValues = z.infer<typeof loginSchema>;
export type CompanyValue = z.infer<typeof companySchema>;
export type AuthUserValue = z.infer<typeof authUserSchema>;
export type AuthSessionValue = z.infer<typeof authSessionSchema>;
export type CompanyBrandingValue = z.infer<typeof companyBrandingSchema>;
export type CompanyContract = Company;
export type AuthSessionContract = AuthSession;
export type { ApiErrors };
